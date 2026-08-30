/* =========================================================
 * 云端同步层 · CloudBase 云函数版（替换 zy-sync.js）
 * - 与 zy-sync.js 保持同一套对外 API（pull/push/bootstrap/
 *   markDirty/startPoll/stopPoll/syncNow/tomb/tombMany/getState）
 * - 所有数据访问经云函数 zy-api（登录/注册/审核/拉取/推送），
 *   服务端 bcrypt + JWT + 角色过滤，前端不再直连数据库
 * - 本机 localStorage 仍作为离线缓存；云为权威（合并云端胜）
 * - 兼容模式：未配置云函数地址时，自动回退到本机单机模式
 * ========================================================= */
window.ZY = (function(){
  'use strict';
  const LS_LAST = 'zy_lastSyncTs';
  const LS_BACK = 'zy_backup';
  const LS_CFG  = 'zy_cb_cfg';

  /* ---------- 配置：云函数 HTTP 地址（部署后填入，可在系统设置覆盖） ---------- */
  function getCfg(){
    let saved=null;
    try{ saved = JSON.parse(localStorage.getItem(LS_CFG)||'null'); }catch(e){}
    return Object.assign({
      endpoint: (typeof window.ZY_CB_ENDPOINT !== 'undefined') ? window.ZY_CB_ENDPOINT : '',
      token: localStorage.getItem('zy_cb_token') || ''
    }, saved||{});
  }
  function saveCfg(cfg){ localStorage.setItem(LS_CFG, JSON.stringify(cfg)); }
  let CFG = getCfg();

  const isCloud = ()=> !!(CFG.endpoint && CFG.endpoint.indexOf('http')===0);

  let timer=null, flushTimer=null, dirty=false;
  let lastSync = Number(localStorage.getItem(LS_LAST)||0);

  /* ---------- 同步状态（顶栏指示器） ---------- */
  let state={code:'idle', msg:'', at:0};
  function setState(code,msg){
    state={code:code,msg:msg||'',at:Date.now()};
    try{ if(window.renderSyncBadge) window.renderSyncBadge(state); }catch(e){}
  }
  function getState(){
    if(!navigator.onLine) return {code:'offline',msg:'当前设备无网络',at:Date.now(),lastSync:lastSync};
    return Object.assign({},state,{lastSync:lastSync, cloud:isCloud()});
  }

  /* ---------- 调用云函数 ---------- */
  async function call(action, payload){
    if(!isCloud()) return {ok:false, offline:true, msg:'未配置云端地址，当前为单机模式'};
    try{
      const r = await fetch(CFG.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(Object.assign({action}, payload||{}))
      });
      if(!r.ok) return {ok:false, msg:'云函数 HTTP '+r.status};
      const j = await r.json();
      return j||{ok:false, msg:'云端返回为空'};
    }catch(e){ return {ok:false, msg:'网络错误：'+e.message}; }
  }

  /* ---------- 登录（服务端 bcrypt 校验，返回 token+user） ---------- */
  async function login(idCard, pwd){
    const r = await call('login', {idCard, pwd});
    if(r.ok && r.token){
      CFG = Object.assign({}, CFG, {token:r.token});
      localStorage.setItem('zy_cb_token', r.token);
      saveCfg(CFG);
      setState('ok');
    }
    return r;
  }
  function logout(){
    CFG = Object.assign({}, CFG, {token:''});
    localStorage.removeItem('zy_cb_token');
    saveCfg(CFG);
  }

  /* ---------- 注册 / 重置密码 / 审核 / 口令（服务端） ---------- */
  const register  = (user)=> call('register', {user});
  const resetPwd  = (o)=>    call('resetPwd', o);
  const auditApprove = (userId)=> call('auditApprove', {token:CFG.token, userId});
  const auditReject  = (userId)=> call('auditReject',  {token:CFG.token, userId});
  const getTotp      = (userId)=> call('totp', {token:CFG.token, userId});

  /* ---------- 拉取（服务端按角色过滤） ---------- */
  async function pull(){
    setState('syncing');
    if(!isCloud()){
      /* 未配置：返回空库，单机可用 */
      setState('idle');
      return {ok:true, empty:true, local:true, remoteTs:null};
    }
    const r = await call('pull', {token:CFG.token});
    if(r.ok && r.data){
      setState('ok');
      return {ok:true, data:r.data, remoteTs:Date.now()};
    }
    if(r.ok && r.empty){
      setState('ok');
      return {ok:true, empty:true, remoteTs:null};
    }
    setState('err', r.msg||'拉取失败');
    return {ok:false, msg:r.msg||'拉取失败'};
  }

  /* ---------- 推送（整库合并上云） ---------- */
  async function push(){
    const db = window.DB || {};
    if(!isCloud()) return {ok:true, local:true};
    setState('syncing');
    const r = await call('push', {token:CFG.token, db});
    if(r.ok){
      lastSync = Date.now(); localStorage.setItem(LS_LAST, String(lastSync));
      setState('ok');
      return {ok:true};
    }
    setState('err', r.msg||'上传失败');
    return {ok:false, msg:r.msg||'上传失败'};
  }

  function markDirty(){ dirty=true; scheduleFlush(); }
  function scheduleFlush(){
    if(flushTimer) return;
    flushTimer = setTimeout(async()=>{ flushTimer=null; if(dirty){ dirty=false; await push(); } }, 400);
  }

  /* ---------- 轮询（多设备实时同步） ---------- */
  function startPoll(){
    stopPoll();
    timer = setInterval(async()=>{
      try{
        if(!isCloud()) return;
        const p = await pull();
        if(p.ok && p.data){
          const backup = window.DB;
          try{ localStorage.setItem(LS_BACK, JSON.stringify(window.DB)); }catch(e){}
          window.DB = p.data;           /* 云为权威：直接采用服务端过滤后的数据 */
          if(window.normalizeDB) window.normalizeDB();
          if(window.saveDB) window.saveDB();
          if(window.renderRoute) window.renderRoute();
          if(window.updateNotifyBadge) window.updateNotifyBadge();
          if(window.toast) window.toast('已同步云端最新数据','ok');
          if(window._cloudMergeCb) window._cloudMergeCb(p.data, backup);
        }
      }catch(e){ /* 静默 */ }
    }, 15000);
  }
  function stopPoll(){ if(timer){ clearInterval(timer); timer=null; } }

  /* ---------- 首次接入 ---------- */
  async function bootstrap(){
    if(!isCloud()) return {ok:true, local:true};
    const p = await pull();
    if(p.ok && p.data){
      window.DB = p.data;
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      await push();
      lastSync = Date.now(); localStorage.setItem(LS_LAST, String(lastSync));
      return {ok:true, pulled:true};
    }
    if(p.ok && p.empty){
      if(hasLocalData()) return await push();
      return {ok:true, empty:true};
    }
    return p;
  }

  /* ---------- 手动立即同步 ---------- */
  async function syncNow(){
    if(!isCloud()) return {ok:true, local:true};
    setState('syncing');
    const p = await pull();
    if(p.ok && p.data){
      window.DB = p.data;
      if(window.normalizeDB) window.normalizeDB();
      if(window.saveDB) window.saveDB();
      if(window.renderRoute) window.renderRoute();
      if(window.updateNotifyBadge) window.updateNotifyBadge();
      const pu = await push();
      return pu;
    }
    if(p.ok && p.empty) return await push();
    return p;
  }

  function hasLocalData(){
    const db=window.DB;
    return !!db && ((db.users||[]).length>0 || (db.services||[]).length>0 || (db.activities||[]).length>0);
  }

  /* 墓碑兼容：CloudBase 模式由服务端合并处理删除，本地同样记录防覆盖 */
  function tomb(type, key){
    if(!window.DB || !key) return;
    if(!window.DB._tomb) window.DB._tomb={};
    window.DB._tomb[type+':'+key]=Date.now();
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
  }
  function tombMany(type, keys){
    if(!window.DB) return;
    if(!window.DB._tomb) window.DB._tomb={};
    (keys||[]).forEach(k=>{ if(k) window.DB._tomb[type+':'+k]=Date.now(); });
    try{ if(window.saveDB) window.saveDB(); }catch(e){}
    markDirty();
  }

  try{
    window.addEventListener('online', ()=>{ setState('syncing'); syncNow().catch(()=>{}); });
    window.addEventListener('offline', ()=>{ setState('offline','当前设备无网络'); });
  }catch(e){}

  return {
    pull, push, bootstrap, markDirty, startPoll, stopPoll, syncNow,
    login, logout, register, resetPwd, auditApprove, auditReject, getTotp,
    tomb, tombMany, getState,
    get cfg(){ return CFG; },
    get cloud(){ return isCloud(); }
  };
})();

/* 兼容旧引用（审核中心旧代码可能引用 ZYReg/ZYStatus，置为安全空实现） */
window.ZYReg = window.ZYReg || { submit:async()=>({ok:false,msg:'CloudBase 模式无需注册队列'}), listAll:async()=>({ok:true,list:[]}), remove:async()=>({ok:true}) };
window.ZYStatus = window.ZYStatus || { check:async()=>({ok:true,status:null}), set:async()=>({ok:true}) };
