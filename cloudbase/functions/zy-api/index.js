/* =========================================================
 * 宣汉职校志愿服务平台 · CloudBase 云函数 zy-api
 * 职责：全部数据访问唯一入口（前端不再直连数据库）
 *  - login / register / resetPwd / auditApprove / auditReject
 *  - pull（按角色服务端过滤后返回） / push（整库上云）
 *  - totp（管理员查看成员动态口令）
 * 安全：bcrypt 密码哈希 + JWT 会话 + 服务端角色/部门过滤
 * 部署：CloudBase 云函数（Nodejs16.13），HTTP 触发
 * ========================================================= */
const cloudbase = require('@cloudbase/node-sdk');
const crypto = require('crypto');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

/* ---------- 配置（部署时在云函数环境变量中注入） ---------- */
const JWT_SECRET = process.env.ZY_JWT_SECRET || 'zhiyuan-volunteer-2026-cloud';
const TOKEN_TTL  = 7 * 24 * 3600 * 1000;          // 7 天
const TOTP_STEP  = 300000;                          // 动态口令 5 分钟（毫秒，与前端 computeTOTP 的 300000 一致）

/* =========================================================
 * 密码哈希（bcrypt）
 * ========================================================= */
const bcrypt = require('bcryptjs');
function hashPwd(pwd){ return bcrypt.hashSync(String(pwd||''), 10); }
function verifyPwd(pwd, hash){ try{ return bcrypt.compareSync(String(pwd||''), String(hash||'')); }catch(e){ return false; } }

/* =========================================================
 * JWT（HMAC-SHA256，无依赖手写）
 * ========================================================= */
function b64url(buf){ return Buffer.from(buf).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
function signToken(payload){
  const head = b64url(JSON.stringify({alg:'HS256',typ:'JWT'}));
  const body = b64url(JSON.stringify(Object.assign({exp:Date.now()+TOKEN_TTL}, payload)));
  const sig  = crypto.createHmac('sha256', JWT_SECRET).update(head+'.'+body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return head+'.'+body+'.'+sig;
}
function verifyToken(token){
  try{
    const parts = String(token||'').split('.');
    if(parts.length!==3) return null;
    const body = JSON.parse(Buffer.from(parts[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString());
    if(!body.exp || body.exp < Date.now()) return null;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(parts[0]+'.'+parts[1]).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    if(sig !== parts[2]) return null;
    return body;
  }catch(e){ return null; }
}

/* =========================================================
 * TOTP（与前端 computeTOTP 完全一致：HMAC-SHA1 + 300s 步长）
 * ========================================================= */
function totpAt(secretHex, step, ts){
  const t = Math.floor((ts||Date.now())/step), msg = new Array(8);
  let v = t; for(let i=7;i>=0;i--){ msg[i]=v&0xff; v=Math.floor(v/256); }
  const key = Buffer.from(String(secretHex||''), 'hex');
  const h = crypto.createHmac('sha1', key).update(Buffer.from(msg)).digest();
  const b = Array.from(h);
  const off = b[19]&0x0f;
  const bin = (((b[off]&0x7f)<<24)|((b[off+1]&0xff)<<16)|((b[off+2]&0xff)<<8)|(b[off+3]&0xff))>>>0;
  return String(bin%1000000).padStart(6,'0');
}
function verifyTotp(secretHex, code){
  if(!secretHex || !code) return false;
  const cur = totpAt(secretHex, TOTP_STEP, Date.now());
  if(cur===String(code).trim()) return true;
  // 允许前后一个窗口（容错 ±5 分钟）
  return [TOTP_STEP, -TOTP_STEP].some(delta=>{
    try{
      const past = totpAt(secretHex, TOTP_STEP, Date.now()+delta);
      if(past===String(code).trim()) return true;
    }catch(e){}
    return false;
  });
}

/* =========================================================
 * 数据读写（集合 zy_db，单行 id=1 存整库 JSON）
 * ========================================================= */
const COLL = 'zy_db';
async function readDB(){
  const res = await db.collection(COLL).doc('1').get().catch(()=>({data:[]}));
  const row = res.data && res.data[0];
  if(!row || !row.data) return null;
  return row.data;
}
async function writeDB(data){
  try{
    await db.collection(COLL).doc('1').set({ data: data });
  }catch(e){
    /* 集合不存在时自动创建（首次部署零手工步骤） */
    const msg = String(e.message||e);
    if(msg.indexOf('NOT_EXIST')>=0 || msg.indexOf('not exist')>=0 || msg.indexOf('collection')>=0){
      try{ await db.createCollection(COLL); }catch(e2){}
      await db.collection(COLL).doc('1').set({ data: data }).catch(async e3=>{
        await db.collection(COLL).add({ _id:'1', data: data }).catch(e4=>{ throw e4; });
      });
    }else{
      throw e;
    }
  }
}

/* =========================================================
 * 角色/部门权限
 * ========================================================= */
const TOP_ROLES = ['super','terminal','dev'];
const MGMT_ROLES = ['president','vice','minister','broadcaster','etiquette','subleague'];
function isTop(u){ return TOP_ROLES.includes(u.role); }
function isManager(u){ return MGMT_ROLES.includes(u.role); }
/* 该管理员可审核的部门：本部门（super/terminal/dev 看全部） */
function auditOrgs(u){
  if(isTop(u)) return null;                 // null = 全部
  return [u.org].filter(Boolean);
}
/* 服务端过滤：按当前登录用户角色返回其可见数据（防止越权拉全库） */
function filterDB(raw, user){
  const out = JSON.parse(JSON.stringify(raw||{}));
  // 1) users：超级/终端/dev 全部；管理级看本部门；普通成员只看到自己
  const users = (raw.users||[]).map(u=>({...u}));
  if(isTop(user)) out.users = users;
  else if(isManager(user)){
    out.users = users.filter(u=> u.org===user.org || u.id===user.id || TOP_ROLES.includes(u.role));
  }else{
    out.users = users.filter(u=> u.id===user.id);
  }
  // 2) 脱敏：移除密码等敏感字段
  out.users = (out.users||[]).map(u=>{
    const c={...u};
    delete c.pwd; delete c.totpSecret; delete c.salt;
    return c;
  });
  // 3) 通知：按接收人过滤（与前端 updateNotifyBadge 一致）
  const roleLabelMap = {};
  ((raw.dictionaries||{}).role||[]).forEach(r=>{ roleLabelMap[r.val]=r.label; });
  const myLabel = roleLabelMap[user.role] || user.role;
  const notifies = (raw.notifies||[]).filter(n=> n.to==='all' || n.to===user.name || n.to===myLabel);
  out.notifies = notifies;
  // 4) 痕迹日志：仅终端管理员可见
  if(user.role!=='terminal'){ out.traces = []; out.logs = (raw.logs||[]).filter(l=> l.user===user.name); }
  return out;
}
/* 服务端合并（与前端 mergeDB 语义一致：云端权威 + 保留本地独有 + 墓碑过滤） */
function mergeUsers(localArr, cloudArr, tombs){
  const map={};
  (cloudArr||[]).forEach(x=>{ if(x&&x.idCard) map[x.idCard]=x; });
  (localArr||[]).forEach(x=>{ if(x&&x.idCard&&!map[x.idCard]) map[x.idCard]=x; });
  if(tombs){ Object.keys(map).forEach(k=>{ if(tombs['users:'+k]) delete map[k]; }); }
  return Object.values(map);
}
function mergeArrays(localArr, cloudArr, keyFn, type, tombs){
  const map={};
  (cloudArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
  (localArr||[]).forEach(x=>{ if(x&&keyFn(x)) map[keyFn(x)]=x; });
  if(type && tombs){
    Object.keys(map).forEach(k=>{ if(tombs[type+':'+k]) delete map[k]; });
  }
  return Object.values(map);
}
function mergeDB(local, cloud){
  const out=JSON.parse(JSON.stringify(cloud||{}));
  const T=Object.assign({}, cloud._tomb||{}, local._tomb||{});
  out._tomb=T;
  out.users=mergeUsers(local.users, cloud.users, T);
  ['services','activities','tasks','news','notifies','others','broadcastRecs','etiquetteRecs','subleagueRecs','quotas','evaluations','reports','summaries','traces','logs'].forEach(k=>{
    out[k]=mergeArrays(local[k], cloud[k], x=>x.id, k, T);
  });
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

/* =========================================================
 * 操作日志（云侧留痕：登录/注册/审核/重置密码等安全事件）
 * ========================================================= */
async function cloudLog(action, content, user){
  try{
    const data = await readDB() || {};
    if(!data.logs) data.logs=[];
    data.logs.unshift({id:'cl'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), time:new Date().toLocaleString('zh-CN',{hour12:false}), user:user?user.name:'-', role:user?user.role:'-', action, content});
    if(data.logs.length>500) data.logs.length=500;
    await writeDB(data);
  }catch(e){}
}

/* =========================================================
 * HTTP 入口
 * ========================================================= */
exports.main = async (event, context) => {
  // CloudBase HTTP 触发：event.body 为字符串，解析 JSON
  let payload = {};
  try{
    const raw = (event && event.body) ? event.body : (event||{});
    payload = typeof raw==='string' ? JSON.parse(raw) : raw;
  }catch(e){ return json({ok:false, msg:'请求体格式错误'}); }
  const action = payload.action;
  try{
    switch(action){
      case 'login':        return await actLogin(payload);
      case 'register':     return await actRegister(payload);
      case 'resetPwd':     return await actResetPwd(payload);
      case 'auditApprove': return await actAudit(payload, true);
      case 'auditReject':  return await actAudit(payload, false);
      case 'pull':         return await actPull(payload);
      case 'push':         return await actPush(payload);
      case 'import':       return await actImport(payload);
      case 'totp':         return await actTotp(payload);
      case 'ping':         return json({ok:true, msg:'zy-api 运行正常', t:Date.now()});
      default: return json({ok:false, msg:'未知操作 '+action});
    }
  }catch(e){
    console.error('zy-api error:', e);
    return json({ok:false, msg:'服务端错误：'+(e.message||e)});
  }
};

function json(obj){ return { statusCode:200, headers:{'Content-Type':'application/json; charset=utf-8'}, body: JSON.stringify(obj) }; }

/* ---------- 登录 ---------- */
async function actLogin(p){
  const idCard = String(p.idCard||'').trim(), pwd = String(p.pwd||'');
  if(!idCard || !pwd) return json({ok:false, msg:'请填写身份证号和密码'});
  const data = await readDB();
  if(!data || !Array.isArray(data.users)) return json({ok:false, msg:'云端暂无可登录账号'});
  const u = data.users.find(x=>x.idCard===idCard);
  if(!u) return json({ok:false, msg:'身份证号或密码不正确'});
  if(!verifyPwd(pwd, u.pwd)) return json({ok:false, msg:'身份证号或密码不正确'});
  if(u.activated===false){
    if(u.pending) return json({ok:false, msg:'账号未激活：注册申请正在审核中，请稍后再试'});
    return json({ok:false, msg:'账号未激活，请联系管理员'});
  }
  const token = signToken({uid:u.id, role:u.role, name:u.name, org:u.org||''});
  const safe = Object.assign({}, u); delete safe.pwd; delete safe.totpSecret;
  cloudLog('登录', `${u.name} 登录成功`, u);
  return json({ok:true, token, user:safe});
}

/* ---------- 注册（服务端生成 pending 用户 + 通知） ---------- */
async function actRegister(p){
  const u = p.user || {};
  const idCard = String(u.idCard||'').trim(), name = String(u.name||'').trim(), pwd = String(u.pwd||'');
  if(!/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(idCard)) return json({ok:false, msg:'身份证号格式不正确'});
  if(!name) return json({ok:false, msg:'请填写姓名'});
  if(pwd.length<6) return json({ok:false, msg:'密码至少 6 位'});
  const org = String(u.org||'').trim();
  if(!org) return json({ok:false, msg:'请选择所在部门'});
  const data = await readDB() || {};
  if(!data.users) data.users=[];
  const exist = data.users.find(x=>x.idCard===idCard);
  if(exist) return json({ok:false, msg: exist.activated ? '该身份证号已注册' : '该身份证号已提交注册，正在审核中'});
  const next = ((data.nextIds||{}).user||0)+1;
  const nu = Object.assign({}, u, {
    id:'u-'+next, pwd: hashPwd(pwd), activated:false, pending:true, position:'志愿者',
    createdAt: new Date().toLocaleString('zh-CN',{hour12:false})
  });
  data.users.push(nu);
  data.nextIds = Object.assign({}, data.nextIds||{}, {user:next});
  // 审核通知（部门分流）：本部门管理员 + 超级/终端
  if(!data.notifies) data.notifies=[];
  const targets = auditNotifyTargets(org);
  targets.forEach(t=>{
    data.notifies.unshift({id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), to:t, kind:'audit', org, unread:true, pending:true, time:new Date().toLocaleString('zh-CN',{hour12:false}), title:`【${org}】新注册待审核`, content:`${name} 申请加入「${org}」，请本部门管理员审核`});
  });
  await writeDB(data);
  cloudLog('注册', `新注册 ${name}（${org}）待审核`, null);
  return json({ok:true, msg:'注册成功，请等待本部门管理员审核'});
}
/* 与前端一致的审核通知目标（服务端再算一遍，防篡改） */
function auditNotifyTargets(org){
  const map = {
    '青年志愿者协会':['超级管理员','终端管理员','会 长'],
    '广播站':['超级管理员','终端管理员','广播站站长'],
    '礼仪队':['超级管理员','终端管理员','礼仪队队长'],
    '团副总支':['超级管理员','终端管理员','团副总支'],
    '团总支':['超级管理员','终端管理员','团总支书记'],
    '学生会':['超级管理员','终端管理员','学生会主席'],
  };
  return map[org] || ['超级管理员','终端管理员'];
}

/* ---------- 重置密码（姓名或动态口令验证） ---------- */
async function actResetPwd(p){
  const idCard = String(p.idCard||'').trim(), name = String(p.name||'').trim(), key = String(p.key||'').trim();
  const p1 = String(p.pwd||''), p2 = String(p.pwd2||'');
  if(!idCard) return json({ok:false, msg:'请填写身份证号'});
  if(p1.length<6) return json({ok:false, msg:'新密码至少 6 位'});
  if(p1!==p2) return json({ok:false, msg:'两次密码输入不一致'});
  const data = await readDB();
  if(!data || !Array.isArray(data.users)) return json({ok:false, msg:'云端暂无该账号'});
  const u = data.users.find(x=>x.idCard===idCard);
  if(!u) return json({ok:false, msg:'该身份证号未注册'});
  if(key){
    if(!verifyTotp(u.totpSecret, key)) return json({ok:false, msg:'动态口令错误，请核对后重试'});
  }else{
    if(!name) return json({ok:false, msg:'请填写姓名，或使用动态口令'});
    if(u.name!==name) return json({ok:false, msg:'身份证号 + 姓名不匹配'});
  }
  u.pwd = hashPwd(p1);
  await writeDB(data);
  cloudLog('重置密码', `${u.name} 通过${key?'动态口令':'姓名'}重置密码`, null);
  return json({ok:true, msg:'密码已重置，请用新密码登录'});
}

/* ---------- 审核（服务端角色+部门校验，前端传 token） ---------- */
async function actAudit(p, approve){
  const token = p.token;
  const auth = verifyToken(token);
  if(!auth) return json({ok:false, msg:'登录已过期，请重新登录'});
  const userId = p.userId;
  const data = await readDB();
  if(!data || !Array.isArray(data.users)) return json({ok:false, msg:'云端无数据'});
  const u = data.users.find(x=>x.id===userId);
  if(!u) return json({ok:false, msg:'未找到该成员'});
  // 权限：超级/终端可审全部；管理级只能审本部门
  const orgs = auditOrgs(auth);
  if(orgs && !orgs.includes(u.org)) return json({ok:false, msg:'无权审核该部门成员'});
  const actor = data.users.find(x=>x.id===auth.uid) || {};
  if(approve){
    u.activated = true; u.pending = false; u.status = u.status||'正常在岗';
  }else{
    // 驳回：移除该成员（或置 pending=false 由前端决定）。这里直接移除，身份证立即释放
    data.users = data.users.filter(x=>x.id!==userId);
  }
  // 结果通知本人
  if(!data.notifies) data.notifies=[];
  data.notifies.unshift({id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), to:u.name, kind:'audit', unread:true, pending:false, time:new Date().toLocaleString('zh-CN',{hour12:false}), title: approve?'注册审核通过':'注册审核被驳回', content: approve?`欢迎加入${u.org||''}，你现在可以登录了`:`很抱歉，你的注册申请未通过审核`});
  await writeDB(data);
  cloudLog(approve?'审核通过':'审核驳回', `${actor.name} ${approve?'通过':'驳回'} ${u.name} 的注册`, actor);
  return json({ok:true, msg: approve?'已通过并通知本人':'已驳回并通知本人'});
}

/* ---------- 拉取（按角色过滤） ---------- */
async function actPull(p){
  const auth = verifyToken(p.token);
  if(!auth) return json({ok:false, msg:'登录已过期，请重新登录'});
  const data = await readDB();
  if(!data) return json({ok:true, empty:true, data:null});
  const user = Object.assign({id:auth.uid, role:auth.role, name:auth.name, org:auth.org}, {});
  const filtered = filterDB(data, user);
  return json({ok:true, data:filtered});
}

/* ---------- 推送（整库合并上云；服务端按角色限制写入范围） ---------- */
async function actPush(p){
  const auth = verifyToken(p.token);
  if(!auth) return json({ok:false, msg:'登录已过期，请重新登录'});
  const local = p.db;
  if(!local || typeof local!=='object') return json({ok:false, msg:'数据格式错误'});
  const data = await readDB() || {};
  const merged = mergeDB(local, data);
  await writeDB(merged);
  return json({ok:true, msg:'已同步到云端'});
}

/* ---------- 整库导入/替换（迁移或清空数据用；仅超级/终端/开发可调） ---------- */
async function actImport(p){
  const auth = verifyToken(p.token);
  if(!auth) return json({ok:false, msg:'登录已过期，请重新登录'});
  if(!isTop(auth)) return json({ok:false, msg:'无权限执行该操作'});
  const db = p.db;
  if(!db || typeof db!=='object') return json({ok:false, msg:'数据格式错误'});
  /* 自动升级：迁移来的明文密码 → bcrypt；补 totpSecret */
  (db.users||[]).forEach(u=>{
    if(u && u.pwd && !/^\$2[aby]\$/.test(u.pwd)) u.pwd = hashPwd(u.pwd);
    if(u && !u.totpSecret) u.totpSecret = crypto.randomBytes(16).toString('hex');
  });
  await writeDB(db);
  cloudLog('整库导入', '云端数据已被完整替换', {id:auth.uid, name:auth.name, role:auth.role});
  return json({ok:true, msg:'云端数据导入成功'});
}

/* ---------- 管理员查看成员动态口令 ---------- */
async function actTotp(p){
  const auth = verifyToken(p.token);
  if(!auth) return json({ok:false, msg:'登录已过期，请重新登录'});
  if(!isTop(auth)) return json({ok:false, msg:'无权限查看'});
  const data = await readDB();
  const u = (data.users||[]).find(x=>x.id===p.userId);
  if(!u) return json({ok:false, msg:'未找到该成员'});
  if(!u.totpSecret) return json({ok:false, msg:'该成员未设置密钥，请先为成员生成密钥'});
  return json({ok:true, code: totpAt(u.totpSecret, TOTP_STEP, Date.now()), secret:u.totpSecret});
}
