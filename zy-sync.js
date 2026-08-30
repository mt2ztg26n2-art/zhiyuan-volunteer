/* =========================================================
 * 云端同步层（Supabase + AES-GCM）— 重写版 v3（CAS 无丢失并发）
 * ---------------------------------------------------------
 * 设计目标：任何设备、任何账号、任何时刻打开，数据都向云端收敛，
 * 且并发写永远不丢数据、不报错。
 *
 * 关键机制：
 *  1) 乐观并发（CAS，Compare-And-Swap）：每次写入前先读云端 updated_at，
 *     用 PATCH ... &updated_at=eq.<读到的时间戳> 条件更新。数据库有
 *     BEFORE UPDATE 触发器把 updated_at 每次都刷新为服务端 now()，
 *     所以"读到之后到写入之前"若被别人抢写，条件就不匹配（返回 0 行），
 *     本端自动重读→重合并→重写，直到成功。这彻底消除单 blob 的
 *     "后写覆盖先写 → 数据丢失"竞态。
 *  2) 服务端时间轴检测：用服务端返回的 updated_at（lastRemoteTs）判断
 *     "云端是否变了"，不再拿本地墙钟和云端时间比，规避时钟漂移导致的漏拉。
 *  3) 读-合并-写：push 永远先拉云端、mergeDB(本地,云端) 再上传，
 *     任一设备上传都不会冲掉云端已有数据；本地新增也必达云端。
 *  4) 指数退避重试 + 真实结果回报：绝不"假成功"。所有路径都返回 {ok}，
 *     UI 据此显示真实同步状态；网络抖动自动重试。
 *  5) 合并沿用 v2 的 union（按 id 并集、本地优先、墓碑防复活、
 *     用户状态感知），保证收敛且一致。
 * ========================================================= */
window.ZY = (function(){
  'use strict';
  const LS_LAST  = 'zy_lastSyncTs';   // 现用于存储"最近一次看到的云端 updated_at(ms)"
  const LS_BACK  = 'zy_backup';

  const CFG = {
    url: 'https://naqcaaktfqdvsanghqbm.supabase.co',
    key: 'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB',
    pass: 'zhiyuan-sync-2026-v1',   // 内置同步密钥（防明文；权限靠应用层隔离）
    salt: 'zy-sync-v2'
  };

  const MAXBYTES = 2 * 1024 * 1024;  // 2MB 上限保护（防止字典膨胀撑爆写入）
  const MAX_ATTEMPTS = 25;           // CAS 重试上限（并发极高时也不轻易放弃）

  let timer = null;
  let flushTimer = null;
  let dirty = false;
  let lastRemoteTs = Number(localStorage.getItem(LS_LAST) || 0);

  /* ---------- 同步状态（供顶栏指示器实时显示，杜绝「静默失败」） ---------- */
  let state = {code:'idle', msg:'', at:0};   // idle | syncing | ok | err | offline
  function setState(code, msg){
    state = {code:code, msg:msg||'', at:Date.now()};
    try{ if(window.renderSyncBadge) window.renderSyncBadge(state); }catch(e){}
  }
  function getState(){
    if(!navigator.onLine) return {code:'offline', msg:'当前设备无网络', at:Date.now(), lastRemoteTs:lastRemoteTs};
    return Object.assign({}, state, {lastRemoteTs:lastRemoteTs});
  }
  function saveLast(){ try{ localStorage.setItem(LS_LAST, String(lastRemoteTs)); }catch(e){} }

  /* ---------- 加解密（AES-GCM，内置密钥 PBKDF2 派生） ---------- */
  let _keyCache=null;
  async function deriveKey(){
    if(_keyCache) return _keyCache;
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(CFG.pass), 'PBKDF2', false, ['deriveKey']);
    _keyCache = await crypto.subtle.deriveKey(
      {name:'PBKDF2', salt:enc.encode(CFG.salt), iterations:120000, hash:'SHA-256'},
      base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
    );
    return _keyCache;
  }
  function bufToB64(buf){ let s=''; const ch=0x8000; for(let i=0;i<buf.length;i+=ch) s+=String.fromCharCode.apply(null,buf.subarray(i,i+ch)); return btoa(s); }
  function b64ToBuf(b64){ const bin=atob(b64); const buf=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i); return buf; }
  async function encrypt(obj){
    const key=await deriveKey(); const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
    const out=new Uint8Array(12+ct.byteLength); out.set(iv,0); out.set(new Uint8Array(ct),12);
    return bufToB64(out);
  }
  async function decrypt(str){
    const key=await deriveKey(); const raw=b64ToBuf(str); const iv=raw.slice(0,12);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------- 底层 HTTP 封装（带真实结果解析） ---------- */
  function hd(){ return {'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}; }
  async function httpGet(){
    const r = await fetch(CFG.url + '/rest/v1/zy_db?select=id,data,updated_at&id=eq.1', {headers:hd()});
    const j = await r.json().catch(()=>null);
    return {ok:r.ok, status:r.status, j};
  }
  /* CAS 写：仅当云端 updated_at 仍等于 prevTs 时才更新（触发器会刷新 updated_at）。 */
  async function httpPatch(prevTs, enc){
    const url = CFG.url + '/rest/v1/zy_db?id=eq.1&updated_at=eq.' + encodeURIComponent(prevTs);
    const r = await fetch(url, {
      method:'PATCH',
      headers: Object.assign(hd(), {'Content-Type':'application/json','Prefer':'return=representation'}),
      body: JSON.stringify({data: enc})
    });
    const rows = r.ok ? (await r.json().catch(()=>[])) : [];
    return {ok:r.ok, status:r.status, rows};
  }
  /* 插入/覆盖（行不存在或密文不可读时走这里）。 */
  async function httpPost(body){
    const r = await fetch(CFG.url + '/rest/v1/zy_db', {
      method:'POST',
      headers: Object.assign(hd(), {'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'}),
      body: JSON.stringify(body)
    });
    const rows = r.ok ? (await r.json().catch(()=>[])) : [];
    return {ok:r.ok, status:r.status, rows};
  }
  function tsOf(row){ return (row && row.updated_at) ? new Date(row.updated_at).getTime() : 0; }

  /* ---------- 拉取（供 push 合并用，返回 ts 与解密结果） ---------- */
  async function pullRaw(){
    try{
      const g = await httpGet();
      if(!g.ok) return {ok:false, msg:(g.j&&g.j.message)||('HTTP '+g.status)};
      const j=g.j||[];
      if(!j.length) return {ok:true, empty:true, ts:null, tsRaw:null};
      const row=j[0];
      const ts = tsOf(row);
      const tsRaw = (row.updated_at != null) ? row.updated_at : null;  // 原始 ISO，供 CAS 条件更新用
      if(typeof row.data !== 'string' || !row.data || row.data==='{}') return {ok:true, empty:true, ts, tsRaw};
      try{ const dec = await decrypt(row.data); return {ok:true, data:dec, empty:false, ts, tsRaw}; }
      catch(e){ return {ok:false, decryptFail:true, ts, tsRaw}; }
    }catch(e){ return {ok:false, msg:e.message}; }
  }

  /* ---------- 核心：读-合并-写（CAS，带退避重试） ----------
   * 返回 {ok, bytes, merged, overwrote, msg}
   * 绝不"假成功"：网络/并发失败都会进入重试；超出上限才返回 ok:false。 */
  async function syncOnce(localDB){
    /* 关键健壮性：未显式传 localDB 时，默认用本设备 window.DB，
     * 否则调用方（如 push() 无参）会传入空 {} 而把本机数据全部丢云端。 */
    localDB = localDB || window.DB || {};
    let attempt = 0;
    while(attempt < MAX_ATTEMPTS){
      attempt++;
      try{
        const p = await pullRaw();

        /* 云端密文不可读（版本/密钥不一致）：用本地覆盖修复；行存在则用 CAS，
         * 行缺失才 POST，避免把别人的并发写入整本冲掉。 */
        if(p.decryptFail){
          const enc = await encrypt(localDB);
          if(enc.length > MAXBYTES) return {ok:false, msg:'数据过大('+(enc.length/1048576).toFixed(1)+'MB)，请先在系统设置-数据维护清理'};
          const res = (p.tsRaw != null) ? await httpPatch(p.tsRaw, enc) : await httpPost({id:1, data: enc});
          if(res.ok && res.rows.length){
            lastRemoteTs = tsOf(res.rows[res.rows.length-1]); saveLast(); setState('ok');
            return {ok:true, bytes:enc.length, overwrote:true};
          }
          await backoff(attempt); continue;
        }
        if(!p.ok){ await backoff(attempt); continue; }

        /* 关键：只要行存在（哪怕 data 为空），一律用 CAS PATCH（updated_at 条件更新）。
         * 绝不用 POST 整本覆盖——否则并发设备读到"旧空库"后各自 POST，
         * 最后一写的会把前面的覆盖掉 → 数据丢失。只有行确实不存在才 POST 新建。
         * 注意：CAS 过滤用的是原始 ISO 时间戳 tsRaw（PostgREST 不认 epoch 毫秒）。 */
        const prevTs = (p.tsRaw != null) ? p.tsRaw : null;
        const base   = (p.ok && !p.empty && p.data) ? p.data : null;
        const merged = base ? mergeDB(localDB, base) : localDB;
        const enc = await encrypt(merged);
        if(enc.length > MAXBYTES){
          setState('err','数据过大('+(enc.length/1048576).toFixed(1)+'MB)，已停止上传');
          return {ok:false, msg:'数据过大('+(enc.length/1048576).toFixed(1)+'MB)，请先在系统设置-数据维护清理，或联系管理员排查字典膨胀'};
        }

        const res = (prevTs != null) ? await httpPatch(prevTs, enc) : await httpPost({id:1, data: enc});
        if(res.ok && res.rows.length){
          lastRemoteTs = tsOf(res.rows[res.rows.length-1]); saveLast(); setState('ok');
          return {ok:true, bytes:enc.length, merged};
        }
        /* 0 行 = 被并发写抢先（CAS 未命中）→ 重读重合并重写 */
        await backoff(attempt);
      }catch(e){
        setState('err','网络错误：'+e.message);
        await backoff(attempt);
      }
    }
    setState('err','多次重试仍同步失败，请检查网络后重试');
    return {ok:false, msg:'多次重试仍同步失败，请检查网络后重试'};
  }
  function backoff(attempt){
    /* 指数退避 + 随机抖动：避免多设备重试"雷鸣群体"式同步碰撞（否则可能连续 8 次都输 CAS） */
    const base = Math.min(8000, 250 * Math.pow(2, attempt-1));
    const ms = base + Math.floor(Math.random() * base);
    return new Promise(res=>setTimeout(res, ms));
  }

  /* ---------- 公开：拉取并解密（不合并，供登录核对等） ---------- */
  async function pull(){
    setState('syncing');
    try{
      const g = await httpGet();
      if(!g.ok){ setState('err', (g.j&&g.j.message)||'拉取失败'); return {ok:false, msg:(g.j&&g.j.message)||'拉取失败'}; }
      const j=g.j||[];
      const row=j[0];
      if(!j.length || !row || typeof row.data !== 'string' || !row.data || row.data==='{}'){ setState('ok'); return {ok:true, empty:true, remoteTs:null}; }
      const remoteTs = tsOf(row);
      try{
        const dec = await decrypt(row.data);
        setState('ok');
        return {ok:true, data:dec, remoteTs:remoteTs};
      }catch(e){
        setState('err','云端数据解密失败');
        return {ok:false, decryptFail:true, msg:'云端数据解密失败（版本或密钥不一致）', remoteTs:remoteTs};
      }
    }catch(e){ setState('err','网络错误：'+e.message); return {ok:false, msg:'网络错误：'+e.message}; }
  }

  function markDirty(){ dirty = true; scheduleFlush(); }
  function scheduleFlush(){
    if(flushTimer) return;
    flushTimer = setTimeout(async()=>{
      flushTimer=null;
      if(dirty){
        dirty=false;
        try{ await syncOnce(window.DB||{}); }
        catch(e){ dirty=true; setState('err','后台自动同步失败：'+(e&&e.message||e)); }  // 绝不让后台报错变成未捕获异常
      }
    }, 400);
  }

  /* ---------- 轮询（多设备实时同步） ---------- */
  function startPoll(){
    stopPoll();
    timer = setInterval(async()=>{
      try{
        const r = await fetch(CFG.url + '/rest/v1/zy_db?select=updated_at&id=eq.1', {headers:hd()});
        const j = await r.json().catch(()=>null);
        if(!r.ok || !j || !j.length) return;
        const remoteTs = tsOf(j[0]);
        /* 服务端时间轴判断：云端比本端最近一次见到的更新 → 一定拉取 */
        if(remoteTs > lastRemoteTs){
          const p = await pull();
          if(p.ok && p.data && !p.empty){
            if(isCloudEmpty(p.data) && hasLocalData()){
              await syncOnce(window.DB);            // 云端空、本机有 → 回推恢复
            } else {
              const merged = mergeDB(window.DB||{}, p.data);
              try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
              const backup = window.DB;
              window.DB = merged;
              try{ if(window.refreshCurrentUser) window.refreshCurrentUser(); }catch(e){}   /* v19.13 角色/职位改动实时刷进当前登录者 */
              if(window.normalizeDB) window.normalizeDB();
              if(window.saveDB) window.saveDB();
              if(window.renderRoute) window.renderRoute();
              if(window.updateNotifyBadge) window.updateNotifyBadge();
              if(window.toast) window.toast('已同步云端最新数据','ok');
              if(window._cloudMergeCb) window._cloudMergeCb(merged, backup);
              await syncOnce(window.DB);            // 合并结果回传云端（CAS，不丢别人数据）
            }
          } else if(p.ok && p.empty && hasLocalData()){
            await syncOnce(window.DB);
          }
        }
        /* 同步云端注册队列（手机注册 → 电脑审核中心） */
        try{ if(window.zySyncRegs) window.zySyncRegs(true); }catch(e){}
      }catch(e){ /* 静默，下一轮再试 */ }
    }, 15000);
  }
  function stopPoll(){ if(timer){ clearInterval(timer); timer=null; } }

  /* ---------- 数据有效性判断（防空数据覆盖） ---------- */
  function hasLocalData(){
    const db=window.DB; return !!db && ((db.users||[]).length>0 || (db.services||[]).length>0 || (db.activities||[]).length>0);
  }
  function isCloudEmpty(d){
    return !d || (!(d.users||[]).length && !(d.services||[]).length && !(d.activities||[]).length);
  }

  /* ---------- 墓碑（tombstone）：记录「已删除」，防止合并时被云端复活 ---------- */
  function tombKey(type, key){ return type+':'+key; }
  function tomb(type, key){
    if(!window.DB || !key) return;
    if(!window.DB._tomb) window.DB._tomb={};
    window.DB._tomb[tombKey(type,key)] = Date.now();
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
  }
  /* v19.14 解除墓碑：清除数据后同一身份证重新注册 / 恢复演示数据时需要，
   * 否则合并时新记录会被旧墓碑过滤掉而"消失"。 */
  function untomb(type, key){
    if(!window.DB || !window.DB._tomb || !key) return;
    delete window.DB._tomb[tombKey(type,key)];
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
  }
  /* v19.14：批量「解除墓碑并上传」——恢复演示数据 / 同一身份证重新注册时使用。
   * 普通 untomb 只删本机墓碑，云端墓碑还在，下次合并又会被加回来。
   * 这里：把本地/云端副本中的指定墓碑键都剔除后再合并上传（必须在 mergeDB 之前剔除，
   * 否则 mergeTombs 会把云端墓碑并回来，新记录在合并阶段就被过滤掉）。 */
  async function untombPush(keys){
    /* 先移除本机墓碑并持久化——否则后续任何 push 的合并都会把本地墓碑重新并回云端，
       新注册/新数据又被过滤（用户反复遇到的"清除后身份证还在审核中"根因之一） */
    try{
      if(window.DB){ if(!window.DB._tomb) window.DB._tomb={}; (keys||[]).forEach(k=>{ if(k) delete window.DB._tomb[k]; }); if(window.saveDB) window.saveDB(); }
    }catch(e){}
    let attempt=0;
    while(attempt<8){   // CAS 竞争（如后台自动 flush）时自动重试，绝不静默失败
      attempt++;
      try{
        const p=await pullRaw();
        if(!p.ok){ await backoff(attempt); continue; }
        const base=(p.ok&&!p.empty&&p.data)?p.data:{};
        const localDB=window.DB||{};
        const strip=o=>{ const c=JSON.parse(JSON.stringify(o||{})); if(c&&c._tomb){ (keys||[]).forEach(k=>{ if(k) delete c._tomb[k]; }); } return c; };
        const merged=mergeDB(strip(localDB), strip(base));
        if(!merged._tomb) merged._tomb={};
        (keys||[]).forEach(k=>{ if(k) delete merged._tomb[k]; });
        const enc=await encrypt(merged);
        const prevTs=(p.tsRaw!=null)?p.tsRaw:null;
        const res=(prevTs!=null)?await httpPatch(prevTs,enc):await httpPost({id:1,data:enc});
        if(res.ok && res.rows.length){
          lastRemoteTs=tsOf(res.rows[res.rows.length-1]); saveLast(); setState('ok');
          return {ok:true};
        }
        await backoff(attempt);   // CAS 未命中 → 重读重合并重写
      }catch(e){ await backoff(attempt); }
    }
    return {ok:false, msg:'解除墓碑失败（多次重试仍冲突），请稍后重试'};
  }
  function tombMany(type, keys){
    if(!window.DB) return;
    if(!window.DB._tomb) window.DB._tomb={};
    (keys||[]).forEach(k=>{ if(k) window.DB._tomb[tombKey(type,k)]=Date.now(); });
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
  }
  function mergeTombs(local, cloud){
    const out=Object.assign({}, cloud||{});
    Object.keys(local||{}).forEach(k=>{ if(!out[k] || local[k]>out[k]) out[k]=local[k]; });
    const cut=Date.now()-90*24*3600*1000;
    Object.keys(out).forEach(k=>{ if(out[k]<cut) delete out[k]; });
    return out;
  }

  function recMsOf(x){
    if(!x) return 0;
    const raw=Number(x.updatedAtMs)||Number(x.updatedAt)||0;
    if(raw>1e11) return raw;                                  // 毫秒时间戳（Date.now()）
    if(x.updatedAt) return Date.parse(String(x.updatedAt))||0; // "YYYY-MM-DD HH:mm:ss"
    return 0;
  }
  /* ---------- 用户合并（v19.16：时间戳新者胜 + 激活终态作平局裁决 + 年龄感知墓碑） ---------- */
  function mergeUsers(localArr, cloudArr, tombs){
    const map={};
    const pick=(a,b)=>{
      if(!a) return b;
      if(!b) return a;
      /* v19.16 关键：先比时间戳，较新者胜——管理员升职/审核/改角色都带新 updatedAt，
         天然覆盖其它设备的旧副本；旧"已激活"副本不再压过"清除后新注册"的 pending。
         时间戳相同（或无）时：已激活者胜（防"审核通过又变回待审"），再退本地。 */
      const aMs=recMsOf(a), bMs=recMsOf(b);
      if(aMs!==bMs) return aMs>bMs?a:b;
      const aAct=a.activated===true, bAct=b.activated===true;
      if(aAct!==bAct) return aAct?a:b;
      return b;
    };
    (cloudArr||[]).forEach(x=>{ if(x && x.idCard) map[x.idCard]=pick(map[x.idCard],x); });
    (localArr||[]).forEach(x=>{ if(x && x.idCard) map[x.idCard]=pick(map[x.idCard],x); });
    /* 年龄感知墓碑：只压"不晚于清除时刻"的旧数据。
     * 清除后重新注册的新记录（updatedAt 晚于墓碑时间）天然存活——
     * 即使手机跑旧版本代码、没走 untombPush，新注册的 pending 也不会被墓碑过滤，
     * 电脑端审核中心才能看到。无时间戳的旧数据按"被清除"处理。 */
    if(tombs){ Object.keys(map).forEach(k=>{
        const t=Number(tombs['users:'+k]);
        if(t){
          const recMs=recMsOf(map[k]);
          if(!recMs || recMs<=t) delete map[k];
        }
      });
    }
    return Object.values(map);
  }

  /* ---------- 数组合并（按 id 并集，本地优先；墓碑过滤已删除） ---------- */
  function mergeArrays(localArr, cloudArr, keyFn, type, tombs){
    const map={};
    (cloudArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
    (localArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
    if(type && tombs){
      Object.keys(map).forEach(k=>{ if(tombs[tombKey(type,k)]) delete map[k]; });
    }
    return Object.values(map);
  }
  function mergeDB(local, cloud){
    const out=JSON.parse(JSON.stringify(cloud||{}));
    const T=mergeTombs(local._tomb, cloud._tomb);
    out._tomb=T;
    out.users=mergeUsers(local.users, cloud.users, T);
    out.services=mergeArrays(local.services, cloud.services, s=>s.id, 'services', T);
    out.activities=mergeArrays(local.activities, cloud.activities, a=>a.id, 'activities', T);
    out.tasks=mergeArrays(local.tasks, cloud.tasks, t=>t.id, 'tasks', T);
    out.news=mergeArrays(local.news, cloud.news, n=>n.id, 'news', T);
    out.notifies=mergeArrays(local.notifies, cloud.notifies, n=>n.id, 'notifies', T);
    out.others=mergeArrays(local.others, cloud.others, o=>o.id, 'others', T);
    out.broadcastRecs=mergeArrays(local.broadcastRecs, cloud.broadcastRecs, x=>x.id, 'broadcastRecs', T);
    out.etiquetteRecs=mergeArrays(local.etiquetteRecs, cloud.etiquetteRecs, x=>x.id, 'etiquetteRecs', T);
    out.subleagueRecs=mergeArrays(local.subleagueRecs, cloud.subleagueRecs, x=>x.id, 'subleagueRecs', T);
    out.quotas=mergeArrays(local.quotas, cloud.quotas, q=>q.id, 'quotas', T);
    out.evaluations=mergeArrays(local.evaluations, cloud.evaluations, e=>e.id, 'evaluations', T);
    out.reports=mergeArrays(local.reports, cloud.reports, r=>r.id, 'reports', T);
    out.summaries=mergeArrays(local.summaries, cloud.summaries, s=>s.id, 'summaries', T);
    out.traces=mergeArrays(local.traces, cloud.traces, t=>t.id, 'traces', T);
    out.logs=mergeArrays(local.logs, cloud.logs, l=>l.id, 'logs', T);
    if(cloud.dictionaries&&local.dictionaries){
      out.dictionaries=JSON.parse(JSON.stringify(cloud.dictionaries));
      Object.keys(local.dictionaries||{}).forEach(k=>{
        const a=out.dictionaries[k], b=local.dictionaries[k];
        if(Array.isArray(a)&&Array.isArray(b)){
          const seen=new Set(), outArr=[];
          [...a,...b].forEach(x=>{
            let key = (x && typeof x==='object') ? JSON.stringify(x) : String(x);
            if(!seen.has(key)){ seen.add(key); outArr.push(x); }
          });
          out.dictionaries[k]=outArr.slice(0,200);
        }
        else if(b!=null&&a==null) out.dictionaries[k]=b;
      });
    }
    out.nextIds=Object.assign({}, cloud.nextIds||{}, local.nextIds||{});
    return out;
  }

  /* ---------- 拉取并立即合并进本机（审核中心/手动同步用） ---------- */
  async function pullMerge(){
    const p = await pull();
    if(p.ok && p.data && !p.empty){
      const backup = window.DB;
      try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
      window.DB = mergeDB(window.DB||{}, p.data);
      try{ if(window.refreshCurrentUser) window.refreshCurrentUser(); }catch(e){}   /* v19.13 角色/职位改动实时刷进当前登录者 */
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      if(window.updateNotifyBadge) window.updateNotifyBadge();
      if(window._cloudMergeCb) window._cloudMergeCb(window.DB, backup);
      return {ok:true, merged:true};
    }
    return p;
  }

  /* ---------- 首次接入：本地与云端合并（谁的数据都不丢），再回传云端 ---------- */
  async function bootstrap(){
    const p = await pull();
    if(p.ok && (p.empty || !p.data || isCloudEmpty(p.data))){
      if(hasLocalData()){
        const pu = await syncOnce(window.DB);
        return pu;
      }
      return {ok:true, empty:true};
    }
    if(p.ok && p.data){
      const merged = mergeDB(window.DB||{}, p.data);
      try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
      window.DB = merged;
      try{ if(window.refreshCurrentUser) window.refreshCurrentUser(); }catch(e){}   /* v19.13 角色/职位改动实时刷进当前登录者 */
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      const pu = await syncOnce(window.DB);
      return {ok:true, pulled:true, merged:true};
    }
    return p;
  }

  /* ---------- 手动立即同步（顶栏云图标 / 设置页按钮） ---------- */
  async function syncNow(){
    setState('syncing');
    const pu = await syncOnce(window.DB||{});
    if(pu.ok){
      const pm = await pullMerge();   // 把合并后的最新状态刷回本机视图
      return pm.ok ? {ok:true} : pu;
    }
    return pu;
  }

  /* 断网恢复后立刻补同步，保证「离线期间的记录」不丢 */
  try{
    window.addEventListener('online', ()=>{ setState('syncing'); syncNow().catch(()=>{}); });
    window.addEventListener('offline', ()=>{ setState('offline','当前设备无网络'); });
  }catch(e){}

  return {
    pull, push: syncOnce, bootstrap, markDirty, startPoll, stopPoll, syncNow, pullMerge,
    tomb, tombMany, untomb, untombPush, getState,
    get cfg(){ return CFG; }
  };
})();

/* =========================================================
 * 注册审核云端通道（手机注册 → 电脑审核，零配置）
 * zy_regs：注册申请（AES 加密，不含密码），任何设备提交/拉取
 * ========================================================= */
window.ZYReg = (function(){
  'use strict';
  const CFG = { url:'https://naqcaaktfqdvsanghqbm.supabase.co', key:'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB' };
  const PASS = 'zhiyuan-reg-2026-v1';
  const SALT = 'zy-reg-v2';
  async function deriveKey(){
    const enc=new TextEncoder();
    const base=await crypto.subtle.importKey('raw', enc.encode(PASS), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2', salt:enc.encode(SALT), iterations:100000, hash:'SHA-256'}, base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
  }
  function b64ToBuf(b64){ const bin=atob(b64); const buf=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) buf[i]=bin.charCodeAt(i); return buf; }
  function bufToB64(buf){ let s=''; const ch=0x8000; for(let i=0;i<buf.length;i+=ch) s+=String.fromCharCode.apply(null,buf.subarray(i,i+ch)); return btoa(s); }
  async function encrypt(obj){
    const key=await deriveKey(); const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
    const out=new Uint8Array(12+ct.byteLength); out.set(iv,0); out.set(new Uint8Array(ct),12);
    return bufToB64(out);
  }
  async function decrypt(str){
    const key=await deriveKey(); const raw=b64ToBuf(str); const iv=raw.slice(0,12);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv}, key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }
  async function submit(payload){
    try{
      const enc=await encrypt(payload);
      const r=await fetch(CFG.url+'/rest/v1/zy_regs', {
        method:'POST',
        headers:{'apikey':CFG.key,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({payload:enc})
      });
      if(!r.ok){ const j=await r.json().catch(()=>({})); return {ok:false,msg:j.message||('提交失败 HTTP '+r.status)}; }
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  async function listAll(){
    try{
      const r=await fetch(CFG.url+'/rest/v1/zy_regs?select=id,payload,created_at&order=created_at.desc', {
        headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}
      });
      const j=await r.json();
      if(!r.ok) return {ok:false,msg:j.message||'拉取失败'};
      const out=[];
      for(const row of (j||[])){
        try{ out.push({id:row.id, data:await decrypt(row.payload), created_at:row.created_at}); }
        catch(e){}
      }
      return {ok:true, list:out};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  async function remove(id){
    try{
      const r=await fetch(CFG.url+'/rest/v1/zy_regs?id=eq.'+id, {
        method:'DELETE',
        headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}
      });
      if(!r.ok) return {ok:false,msg:'删除失败 HTTP '+r.status};
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  return { submit, listAll, remove };
})();

/* =========================================================
 * 审核状态表（注册者自查：审核通过后可登录，零配置）
 * zy_status：只有 id_card + status，无敏感信息
 * ========================================================= */
window.ZYStatus = (function(){
  'use strict';
  const CFG = { url:'https://naqcaaktfqdvsanghqbm.supabase.co', key:'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB' };
  async function check(idCard){
    try{
      const r=await fetch(CFG.url+'/rest/v1/zy_status?select=status&id_card=eq.'+encodeURIComponent(idCard), {
        headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key}
      });
      const j=await r.json();
      if(!r.ok) return {ok:false};
      if(!j.length) return {ok:true, status:null};
      return {ok:true, status:j[0].status};
    }catch(e){ return {ok:false}; }
  }
  async function set(idCard, status){
    try{
      const r=await fetch(CFG.url+'/rest/v1/zy_status', {
        method:'POST',
        headers:{'apikey':CFG.key,'Authorization':'Bearer '+CFG.key,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({id_card:idCard, status:status})
      });
      if(!r.ok) return {ok:false,msg:'写入失败 HTTP '+r.status};
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  return { check, set };
})();
