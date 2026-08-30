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
    try{
      const r = await fetch(CFG.url + '/rest/v1/zy_db?select=id,data,updated_at&id=eq.1', {
        headers: {'apikey':CFG.key, 'Authorization':'Bearer '+CFG.key}
      });
      const j = await r.json();
      if(!r.ok) return {ok:false, msg:j.message||'拉取失败'};
      if(!j.length || !j[0].data || j[0].data === '{}') return {ok:true, empty:true, remoteTs:null};
      const remoteTs = new Date(j[0].updated_at).getTime();
      try{
        const dec = await decrypt(j[0].data);
        return {ok:true, data:dec, remoteTs:remoteTs};
      }catch(e){ return {ok:false, decryptFail:true, msg:'云端数据解密失败（版本或密钥不一致）', remoteTs:remoteTs}; }
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  async function push(){
    const db = window.DB || {};
    try{
      const enc = await encrypt(db);
      let r = await fetch(CFG.url + '/rest/v1/zy_db?id=eq.1', {
        method: 'PATCH',
        headers: {'apikey':CFG.key,'Authorization':'Bearer '+CFG.key,'Content-Type':'application/json','Prefer':'return=minimal'},
        body: JSON.stringify({data: enc})
      });
      if(!r.ok && r.status === 404){
        r = await fetch(CFG.url + '/rest/v1/zy_db', {
          method: 'POST',
          headers: {'apikey':CFG.key,'Authorization':'Bearer '+CFG.key,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body: JSON.stringify({id:1, data: enc})
        });
      }
      if(!r.ok){ const j=await r.json().catch(()=>({})); return {ok:false, msg:j.message||('上传失败 HTTP '+r.status)}; }
      lastSync = Date.now(); localStorage.setItem(LS_LAST, String(lastSync));
      return {ok:true};
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
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

  /* ---------- 合并（只增不删，本地优先；任何设备的数据都不丢失） ---------- */
  function mergeArrays(localArr, cloudArr, keyFn){
    const map={};
    (cloudArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
    (localArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
    return Object.values(map);
  }
  function mergeDB(local, cloud){
    const out=JSON.parse(JSON.stringify(cloud||{}));
    out.users=mergeArrays(local.users, cloud.users, u=>u.idCard);
    out.services=mergeArrays(local.services, cloud.services, s=>s.id);
    out.activities=mergeArrays(local.activities, cloud.activities, a=>a.id);
    out.tasks=mergeArrays(local.tasks, cloud.tasks, t=>t.id);
    out.news=mergeArrays(local.news, cloud.news, n=>n.id);
    out.notifies=mergeArrays(local.notifies, cloud.notifies, n=>n.id);
    out.others=mergeArrays(local.others, cloud.others, o=>o.id);
    out.broadcastRecs=mergeArrays(local.broadcastRecs, cloud.broadcastRecs, x=>x.id);
    out.etiquetteRecs=mergeArrays(local.etiquetteRecs, cloud.etiquetteRecs, x=>x.id);
    out.subleagueRecs=mergeArrays(local.subleagueRecs, cloud.subleagueRecs, x=>x.id);
    out.quotas=mergeArrays(local.quotas, cloud.quotas, q=>q.id);
    out.evaluations=mergeArrays(local.evaluations, cloud.evaluations, e=>e.id);
    out.reports=mergeArrays(local.reports, cloud.reports, r=>r.id);
    out.summaries=mergeArrays(local.summaries, cloud.summaries, s=>s.id);
    out.traces=mergeArrays(local.traces, cloud.traces, t=>t.id);
    out.logs=mergeArrays(local.logs, cloud.logs, l=>l.id);
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

  return {
    pull, push, bootstrap, markDirty, startPoll, stopPoll,
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
