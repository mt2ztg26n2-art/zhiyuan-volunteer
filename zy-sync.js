/* =========================================================
 * 云端同步层（Supabase + AES-GCM）
 * - 复用用户的 Supabase 项目（与 will-finance-app 同一套后端）
 * - 【v2 重构】零配置：所有用户、所有设备打开即自动同步，
 *   最高权限者无需逐台配置。
 * - 加密：内置同步密钥（防明文爬虫/防公开明文），
 *   权限隔离由应用层角色/部门逻辑控制（宣传部只能看宣传部）。
 * - 数据：全平台共享 zy_db(id=1)，data 为整库 JSON 的密文。
 * ========================================================= */
window.ZY = (function(){
  'use strict';
  const LS_LAST  = 'zy_lastSyncTs';
  const LS_BACK  = 'zy_backup';

  const CFG = {
    url: 'https://naqcaaktfqdvsanghqbm.supabase.co',
    key: 'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB',
    pass: 'zhiyuan-sync-2026-v1',   // 内置同步密钥（防明文；权限靠应用层隔离）
    salt: 'zy-sync-v2'
  };

  let timer = null;
  let flushTimer = null;
  let dirty = false;
  let lastSync = Number(localStorage.getItem(LS_LAST) || 0);

  /* ---------- 同步状态（供顶栏指示器实时显示，杜绝「静默失败」） ---------- */
  let state = {code:'idle', msg:'', at:0};   // idle | syncing | ok | err | offline
  function setState(code, msg){
    state = {code:code, msg:msg||'', at:Date.now()};
    try{ if(window.renderSyncBadge) window.renderSyncBadge(state); }catch(e){}
  }
  function getState(){
    if(!navigator.onLine) return {code:'offline', msg:'当前设备无网络', at:Date.now(), lastSync:lastSync};
    return Object.assign({}, state, {lastSync:lastSync});
  }

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

  /* ---------- 拉取 / 推送（anon，零配置） ---------- */
  async function pull(){
    setState('syncing');
    try{
      const r = await fetch(CFG.url + '/rest/v1/zy_db?select=id,data,updated_at&id=eq.1', {
        headers: {'apikey':CFG.key, 'Authorization':'Bearer '+CFG.key}
      });
      const j = await r.json();
      if(!r.ok){ setState('err', j.message||'拉取失败'); return {ok:false, msg:j.message||'拉取失败'}; }
      /* 【v19.0】data 列是 jsonb：空库时返回 JS 对象 {} 而非字符串 '{}'，
       * 旧版用 === '{}' 判断永远不成立，导致把空对象送进解密流程报「解密失败」。
       * 正确判断：只有 string 才是有效密文。 */
      const row = j[0];
      if(!j.length || !row || typeof row.data !== 'string' || !row.data){
        setState('ok'); return {ok:true, empty:true, remoteTs:null};
      }
      const remoteTs = new Date(row.updated_at).getTime();
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

  /* 【v19.0 关键修复】改用 UPSERT（POST + merge-duplicates）并强制校验真实写入行数。
   * 旧版用 PATCH ?id=eq.1，一旦 id=1 那行被删（历史 resetDB 会整行 DELETE），
   * PostgREST 对「0 行匹配」的 PATCH 仍返回 204 → 代码误判上传成功，
   * 数据实际从未落云端，造成「提示已同步但换设备什么都没有」。
   * 现在：upsert 必然创建或更新 id=1，并用 return=representation 校验行确实写入。 */
  async function push(){
    const db = window.DB || {};
    try{
      const enc = await encrypt(db);
      const r = await fetch(CFG.url + '/rest/v1/zy_db', {
        method: 'POST',
        headers: {
          'apikey':CFG.key,'Authorization':'Bearer '+CFG.key,
          'Content-Type':'application/json',
          'Prefer':'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify({id:1, data: enc})
      });
      if(!r.ok){
        const j=await r.json().catch(()=>({}));
        setState('err', j.message||('上传失败 HTTP '+r.status));
        return {ok:false, msg:j.message||('上传失败 HTTP '+r.status)};
      }
      /* 真实写入校验：必须返回 1 行且 data 与本次密文一致 */
      const rows = await r.json().catch(()=>null);
      if(!Array.isArray(rows) || !rows.length){
        setState('err','云端未确认写入（返回空行）');
        return {ok:false, msg:'云端未确认写入，请检查网络后重试'};
      }
      lastSync = Date.now(); localStorage.setItem(LS_LAST, String(lastSync));
      setState('ok');
      return {ok:true, bytes: enc.length};
    }catch(e){ setState('err','网络错误：'+e.message); return {ok:false, msg:'网络错误：'+e.message}; }
  }

  function markDirty(){ dirty = true; scheduleFlush(); }
  function scheduleFlush(){
    if(flushTimer) return;
    flushTimer = setTimeout(async()=>{ flushTimer=null; if(dirty){ dirty=false; await push(); } }, 400);
  }

  /* ---------- 轮询（多设备实时同步） ---------- */
  function startPoll(){
    stopPoll();
    timer = setInterval(async()=>{
      try{
        const r = await fetch(CFG.url + '/rest/v1/zy_db?select=updated_at&id=eq.1', {
          headers: {'apikey':CFG.key, 'Authorization':'Bearer '+CFG.key}
        });
        const j = await r.json();
        if(!r.ok || !j.length) return;
        const remoteTs = new Date(j[0].updated_at).getTime();
        if(remoteTs > lastSync + 2500){
          const p = await pull();
          /* 防空覆盖：远端是空库（无用户无业务）而本机有数据 → 不拉取，回推本机恢复云端 */
          if(p.ok && p.data && !p.empty && isCloudEmpty(p.data) && hasLocalData()){
            await push();
          }
          else if(p.ok && p.data && !p.empty){
            /* 合并（只增不删）而非覆盖：本地独有数据保留，云端独有数据并入 */
            const merged = mergeDB(window.DB||{}, p.data);
            try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
            const backup = window.DB;
            window.DB = merged;
            if(window.normalizeDB) window.normalizeDB();
            if(window.saveDB) window.saveDB();
            if(window.renderRoute) window.renderRoute();
            if(window.updateNotifyBadge) window.updateNotifyBadge();
            if(window.toast) window.toast('已同步云端最新数据','ok');
            if(window._cloudMergeCb) window._cloudMergeCb(merged, backup);
            await push(); /* 合并结果回传云端 */
          }
        }
        /* 同步云端注册队列（手机注册 → 电脑审核中心） */
        try{ if(window.zySyncRegs) window.zySyncRegs(true); }catch(e){}
      }catch(e){ /* 静默 */ }
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

  /* ---------- 墓碑（tombstone）：记录「已删除」，防止合并时被云端复活 ----------
   * 旧版 mergeArrays 是「只增不删」，任何一台设备删掉的成员/活动，
   * 下一次轮询就被云端旧副本并回来 → 「删了又出现」「身份证一直被占用」。
   * 现在删除时写墓碑（DB._tomb['users:身份证号']=时间戳），合并时按墓碑过滤，
   * 且墓碑本身在设备间同步，保证「一处删除、全网生效」。 */
  function tombKey(type, key){ return type+':'+key; }
  function tomb(type, key){
    if(!window.DB || !key) return;
    if(!window.DB._tomb) window.DB._tomb={};
    window.DB._tomb[tombKey(type,key)] = Date.now();
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
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
    /* 90 天后自动清理墓碑，避免无限膨胀 */
    const cut=Date.now()-90*24*3600*1000;
    Object.keys(out).forEach(k=>{ if(out[k]<cut) delete out[k]; });
    return out;
  }

  /* ---------- 用户合并（云为权威，根治「审核通过后又变回审核中」） ----------
   * 关键：成员手机每 15s 轮询，会拉到云端「已 activated」的用户；
   * 若按旧逻辑（本地优先）合并，本地残留的 pending 副本会盖掉云端 activated，
   * 并随下一次 push 回写云端 → 审核被成员自己的手机撤销，永久卡在「审核中」。
   * 新逻辑：① 云端副本优先入 map；② 仅当本地有、云端没有时才补入（保留本机刚注册、
   * 尚未上云的独有用户）；③ 冲突一律云端胜；④ 墓碑过滤已删除用户。 */
  function mergeUsers(localArr, cloudArr, tombs){
    const map={};
    (cloudArr||[]).forEach(x=>{ if(x && x.idCard) map[x.idCard]=x; });
    (localArr||[]).forEach(x=>{ if(x && x.idCard && !map[x.idCard]) map[x.idCard]=x; });
    if(tombs){ Object.keys(map).forEach(k=>{ if(tombs['users:'+k]) delete map[k]; }); }
    return Object.values(map);
  }

  /* ---------- 合并（本地优先 + 墓碑过滤；未删除的数据谁都不丢） ---------- */
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
        if(Array.isArray(a)&&Array.isArray(b)) out.dictionaries[k]=Array.from(new Set([...a,...b]));
        else if(b!=null&&a==null) out.dictionaries[k]=b;
      });
    }
    out.nextIds=Object.assign({}, cloud.nextIds||{}, local.nextIds||{});
    return out;
  }

  /* ---------- 首次接入：本地与云端合并（谁的数据都不丢），再回传云端 ---------- */
  async function bootstrap(){
    const p = await pull();
    if(p.ok && (p.empty || !p.data || isCloudEmpty(p.data))){
      if(hasLocalData()){
        const pu = await push();
        return pu;
      }
      return {ok:true, empty:true};
    }
    if(p.ok && p.data){
      const merged = mergeDB(window.DB||{}, p.data);
      try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
      window.DB = merged;
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      await push(); /* 合并结果回传云端，保证本地独有数据也上去 */
      lastSync = Date.now(); localStorage.setItem(LS_LAST, String(lastSync));
      return {ok:true, pulled:true, merged:true};
    }
    return p;
  }

  /* ---------- 手动立即同步（顶栏点击云图标触发，给用户一个确定性的动作） ---------- */
  async function syncNow(){
    setState('syncing');
    const p = await pull();
    if(p.ok && p.data && !p.empty){
      if(isCloudEmpty(p.data) && hasLocalData()){
        return await push();
      }
      const merged = mergeDB(window.DB||{}, p.data);
      window.DB = merged;
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      const pu = await push();
      if(window.renderRoute) window.renderRoute();
      if(window.updateNotifyBadge) window.updateNotifyBadge();
      return pu;
    }
    if(p.ok) return await push();          // 云端空 → 直接上传本地
    if(p.decryptFail) return await push(); // 云端密文不可读 → 用本地覆盖修复
    return p;
  }

  /* 断网恢复后立刻补同步，保证「离线期间的记录」不丢 */
  try{
    window.addEventListener('online', ()=>{ setState('syncing'); syncNow().catch(()=>{}); });
    window.addEventListener('offline', ()=>{ setState('offline','当前设备无网络'); });
  }catch(e){}

  return {
    pull, push, bootstrap, markDirty, startPoll, stopPoll, syncNow,
    tomb, tombMany, getState,
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
  /* 提交注册申请（手机端零配置） */
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
  /* 拉取注册队列（管理员/审核中心，零配置） */
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
  /* 删除一条已处理注册（审核通过/驳回后，零配置） */
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
 * zy_status：只有 idCard + status，无敏感信息
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
