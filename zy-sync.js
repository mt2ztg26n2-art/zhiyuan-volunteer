/* =========================================================
 * 云端同步层（Supabase + AES-GCM）
 * - 复用用户的 Supabase 项目（与 will-finance-app 同一套后端）
 * - 全平台共享一行 zy_db(id=1)，data 为整库 JSON 的密文
 * - 只有知道「云同步密码」的人才能解密，云端即使被公开读也解不开
 * - RLS 策略：仅 Supabase 已登录用户可读写该行（防匿名恶意覆盖）
 * 配置位置：系统设置 → 云端同步（管理角色可见）
 * ========================================================= */
window.ZY = (function(){
  'use strict';
  const LS_CFG   = 'zy_cfg';
  const LS_LAST  = 'zy_lastSyncTs';
  const LS_BACK  = 'zy_backup';

  let cfg = null;      // {url,key,email,pwd}
  let token = null;    // Supabase access_token
  let timer = null;    // 轮询 timer
  let flushTimer = null;
  let dirty = false;

  function loadCfg(){
    try{ cfg = JSON.parse(localStorage.getItem(LS_CFG) || 'null'); }
    catch(e){ cfg = null; }
    return cfg;
  }
  function saveCfg(c){ cfg = c; localStorage.setItem(LS_CFG, JSON.stringify(c)); }
  function clearCfg(){ localStorage.removeItem(LS_CFG); cfg = null; }
  function isCfg(){ return !!(cfg && cfg.url && cfg.key && cfg.email && cfg.pwd); }

  /* ---------- Auth ---------- */
  async function login(){
    if(!isCfg()) return {ok:false, msg:'未配置'};
    try{
      const r = await fetch(cfg.url + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: {'Content-Type':'application/json','apikey':cfg.key},
        body: JSON.stringify({email:cfg.email, password:cfg.pwd})
      });
      const j = await r.json();
      if(!r.ok){ token=null; return {ok:false, code:j.error_code||'', msg:j.error_description||j.msg||'登录失败'}; }
      token = j.access_token;
      return {ok:true};
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  async function signup(){
    if(!isCfg()) return {ok:false, msg:'未配置'};
    try{
      const r = await fetch(cfg.url + '/auth/v1/signup', {
        method: 'POST',
        headers: {'Content-Type':'application/json','apikey':cfg.key},
        body: JSON.stringify({email:cfg.email, password:cfg.pwd})
      });
      const j = await r.json();
      if(r.ok || (j.identities && j.identities.length)) return {ok:true, confirmed:false};
      return {ok:false, msg:j.msg||j.error_description||'注册失败'};
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  /* ---------- 加解密（AES-GCM，密钥 = email|pwd 经 PBKDF2 派生） ---------- */
  async function deriveKey(){
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(cfg.email + '|' + cfg.pwd), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2', salt:enc.encode('zy-sync-v1'), iterations:120000, hash:'SHA-256'},
      base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
    );
  }
  function bufToB64(buf){
    let s=''; const chunk=0x8000;
    for(let i=0;i<buf.length;i+=chunk) s += String.fromCharCode.apply(null, buf.subarray(i, i+chunk));
    return btoa(s);
  }
  function b64ToBuf(b64){
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
    return buf;
  }
  async function encrypt(obj){
    const key = await deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv:iv}, key, data);
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), 12);
    return bufToB64(out);
  }
  async function decrypt(str){
    const key = await deriveKey();
    const raw = b64ToBuf(str);
    const iv = raw.slice(0, 12);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:iv}, key, raw.slice(12));
    return JSON.parse(new TextDecoder().decode(pt));
  }

  /* ---------- 拉取 / 推送 ---------- */
  async function pull(){
    if(!token || !isCfg()) return {ok:false, msg:'未登录'};
    try{
      const r = await fetch(cfg.url + '/rest/v1/zy_db?select=id,data,updated_at&id=eq.1', {
        headers: {'apikey':cfg.key, 'Authorization':'Bearer '+token}
      });
      const j = await r.json();
      if(!r.ok) return {ok:false, msg:j.message||'拉取失败'};
      if(!j.length || !j[0].data || j[0].data === '{}') return {ok:true, empty:true, remoteTs:null};
      const remoteTs = new Date(j[0].updated_at).getTime();
      try{
        const dec = await decrypt(j[0].data);
        return {ok:true, data:dec, remoteTs:remoteTs};
      }catch(e){
        return {ok:false, decryptFail:true, msg:'云端数据解密失败：云同步密码与上传时不一致，或数据已损坏', remoteTs:remoteTs};
      }
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  async function push(){
    if(!token || !isCfg()) return {ok:false, msg:'未登录'};
    const db = window.DB || {};
    try{
      const enc = await encrypt(db);
      let r = await fetch(cfg.url + '/rest/v1/zy_db?id=eq.1', {
        method: 'PATCH',
        headers: {'apikey':cfg.key,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=minimal'},
        body: JSON.stringify({data: enc})
      });
      if(!r.ok && r.status === 404){
        // 行不存在 → upsert 插入
        r = await fetch(cfg.url + '/rest/v1/zy_db', {
          method: 'POST',
          headers: {'apikey':cfg.key,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
          body: JSON.stringify({id:1, data: enc})
        });
      }
      if(!r.ok){ const j = await r.json().catch(()=>({})); return {ok:false, msg:j.message||'上传失败(HTTP '+r.status+')'}; }
      localStorage.setItem(LS_LAST, String(Date.now()));
      return {ok:true};
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  function markDirty(){ dirty = true; scheduleFlush(); }
  function scheduleFlush(){
    if(flushTimer) return;
    flushTimer = setTimeout(async()=>{ flushTimer=null; if(dirty){ dirty=false; await push(); } }, 2500);
  }

  /* ---------- 轮询（多设备实时同步） ---------- */
  function startPoll(){
    stopPoll();
    if(!cfg || !token) return;
    timer = setInterval(async()=>{
      if(!cfg || !token) return;
      try{
        const r = await fetch(cfg.url + '/rest/v1/zy_db?select=updated_at&id=eq.1', {
          headers: {'apikey':cfg.key, 'Authorization':'Bearer '+token}
        });
        const j = await r.json();
        if(!r.ok || !j.length) return;
        const remoteTs = new Date(j[0].updated_at).getTime();
        const last = Number(localStorage.getItem(LS_LAST) || 0);
        if(remoteTs > last + 2500){
          const p = await pull();
          if(p.ok && p.data && !p.empty){
            try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
            const backup = window.DB;
            window.DB = p.data;
            if(window.normalizeDB) window.normalizeDB();
            if(window.saveDB){ window.saveDB(); }
            if(window.renderRoute) window.renderRoute();
            if(window.toast) window.toast('已同步云端最新数据', 'ok');
            if(window._cloudMergeCb) window._cloudMergeCb(p.data, backup);
          }
        }
        /* 同步云端注册队列（手机端注册 → 电脑端审核中心） */
        try{ if(window.zySyncRegs) window.zySyncRegs(true); }catch(e){}
      }catch(e){ /* 静默 */ }
    }, 15000);
  }
  function stopPoll(){ if(timer){ clearInterval(timer); timer=null; } }

  /* ---------- 首次接入：把本地数据推上云端（若云端为空） ---------- */
  async function bootstrap(){
    if(!token || !isCfg()) return {ok:false, msg:'未登录'};
    const p = await pull();
    if(p.ok && (p.empty || !p.data)){
      const pu = await push();
      return pu;
    }
    if(p.ok && p.data){
      // 云端已有数据：以云端为准（先备份本地）
      try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
      window.DB = p.data;
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      localStorage.setItem(LS_LAST, String(Date.now()));
      return {ok:true, pulled:true};
    }
    return p;
  }

  return {
    loadCfg, saveCfg, clearCfg, isCfg,
    login, signup,
    pull, push, bootstrap,
    markDirty, startPoll, stopPoll,
    get token(){ return token; },
    set token(t){ token = t; }
  };
})();

/* =========================================================
 * 注册审核云端通道（手机注册 → 电脑审核）
 * - zy_regs 表：匿名可提交（手机端注册直接写入），管理员登录后拉取
 * - 注册数据用「注册密钥」加密存储，防公开读取到敏感信息
 * ========================================================= */
window.ZYReg = (function(){
  'use strict';
  const REG_KEY = 'zhiyuan-reg-2026-v1';   // 注册数据加密密钥（前端公开但非明文）
  /* 默认 Supabase 项目（publishable key 本就公开可放前端）；管理员配置优先，否则用默认值保证普通成员也能提交注册 */
  const DEFAULT_CFG = {
    url: 'https://naqcaaktfqdvsanghqbm.supabase.co',
    key: 'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB'
  };
  function base(){
    try{
      const c = (window.ZY && ZY.loadCfg());
      if(c && c.url && c.key) return {url:c.url, key:c.key};
    }catch(e){}
    return DEFAULT_CFG;
  }
  async function deriveKey(){
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey('raw', enc.encode(REG_KEY), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2', salt:enc.encode('zy-reg-v1'), iterations:100000, hash:'SHA-256'},
      base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
    );
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
  /* 手机端注册提交：匿名写入 zy_regs（无需管理员 token） */
  async function submit(payload){
    const c=base(); if(!c) return {ok:false,msg:'未配置云端'};
    try{
      const enc=await encrypt(payload);
      const r=await fetch(c.url+'/rest/v1/zy_regs', {
        method:'POST',
        headers:{'apikey':c.key,'Content-Type':'application/json','Prefer':'return=minimal'},
        body:JSON.stringify({payload:enc})
      });
      if(!r.ok){ const j=await r.json().catch(()=>({})); return {ok:false,msg:j.message||('提交失败 HTTP '+r.status)}; }
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  /* 管理员拉取注册队列（authenticated，RLS 仅管理员可读） */
  async function listAuth(){
    const c=base(); if(!c) return {ok:false,msg:'未配置'};
    if(!ZY.token) return {ok:false,msg:'未登录云端'};
    try{
      const r=await fetch(c.url+'/rest/v1/zy_regs?select=id,payload,created_at&order=created_at.desc', {
        headers:{'apikey':c.key,'Authorization':'Bearer '+ZY.token}
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
  /* 管理员删除一条已处理的注册（authenticated） */
  async function remove(id){
    const c=base(); if(!c || !ZY.token) return {ok:false,msg:'未登录'};
    try{
      const r=await fetch(c.url+'/rest/v1/zy_regs?id=eq.'+id, {
        method:'DELETE',
        headers:{'apikey':c.key,'Authorization':'Bearer '+ZY.token}
      });
      if(!r.ok) return {ok:false,msg:'删除失败 HTTP '+r.status};
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  return { submit, listAuth, remove, decrypt };
})();

/* =========================================================
 * 审核状态表（注册者自查：审核通过后可登录）
 * - zy_status：只有 idCard + status，无敏感信息，匿名可读
 * - 管理员审核通过/驳回后写入
 * ========================================================= */
window.ZYStatus = (function(){
  'use strict';
  function base(){
    try{ const c=(window.ZY&&ZY.loadCfg()); if(c&&c.url&&c.key) return {url:c.url,key:c.key}; }catch(e){}
    return {url:'https://naqcaaktfqdvsanghqbm.supabase.co', key:'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB'};
  }
  /* 注册者自查（匿名可读，只返回状态） */
  async function check(idCard){
    const c=base();
    try{
      const r=await fetch(c.url+'/rest/v1/zy_status?select=status&id_card=eq.'+encodeURIComponent(idCard), {
        headers:{'apikey':c.key,'Authorization':'Bearer '+c.key}
      });
      const j=await r.json();
      if(!r.ok) return {ok:false};
      if(!j.length) return {ok:true, status:null};
      return {ok:true, status:j[0].status};
    }catch(e){ return {ok:false}; }
  }
  /* 管理员写入审核结果（authenticated upsert） */
  async function set(idCard, status){
    const c=base(); if(!ZY.token) return {ok:false,msg:'未登录'};
    try{
      const r=await fetch(c.url+'/rest/v1/zy_status', {
        method:'POST',
        headers:{'apikey':c.key,'Authorization':'Bearer '+ZY.token,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify({id_card:idCard, status:status})
      });
      if(!r.ok) return {ok:false,msg:'写入失败 HTTP '+r.status};
      return {ok:true};
    }catch(e){ return {ok:false,msg:'网络错误：'+e.message}; }
  }
  return { check, set };
})();
