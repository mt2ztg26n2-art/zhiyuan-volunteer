/* ============================================================================
 *  宣汉职业中专学校 · 志愿服务智慧管理平台 —— 主控（单机版）
 *  ------------------------------------------------------------------------
 *  数据层：localStorage 本地持久化，零后端、双击即用。
 * ========================================================================== */

'use strict';

/* ============================== 数据层 ============================== */
// 全局错误捕获（显示给用户）
window.addEventListener('error', function(e){
  try{ if(typeof toast==='function') toast('系统错误: '+(e.message||'未知').slice(0,50),'err'); }catch(_){}
  console.error('[runtime]', e.error||e.message);
});
const LS_KEY = 'XHZZ_VOL_DB_v3';
const LS_USR = 'XHZZ_VOL_USER_v3';
let DB = null;
let currentUser = null;

function seedDB(){
  const now = ()=>{ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
  return {
    school:'四川省宣汉职业中专学校', schoolShort:'宣汉职校',
    league:'中国共产主义青年团宣汉职业中专学校委员会', leagueShort:'校团委',
    period:'2026 秋季学期',
    users:[
      /* 纯净系统：只留 3 个系统账号（终端管理员 + 超级管理员/校团委 + 开发维护），
         其他演示账号全部清除，由用户录入真实人员 */
      {id:'u-super',role:'super',org:'校团委',name:'校团委管理员',idCard:'000000000000000001',pwd:'admin123',phone:'13900000001',email:'admin@xhzx.edu.cn',title:'校团委管理员',avatar:'',dept:'',cls:'',gender:'男',nation:'汉族',politics:'中共党员',position:'校团委',activated:true},
      {id:'u-term',role:'terminal',org:'校团委',name:'终端管理员',idCard:'000000000000000002',pwd:'term123',phone:'13900000002',title:'系统维护',avatar:'',dept:'',cls:'',activated:true},
      {id:'u-dev',role:'dev',org:'开发人员',name:'开发维护',idCard:'000000000000000099',pwd:'dev123',phone:'13900000099',title:'系统开发',avatar:'',dept:'',cls:'',activated:true}
    ],
    dictionaries:{
      role:[
        {val:'super',label:'超级管理员'},{val:'terminal',label:'终端管理员'},{val:'president',label:'会 长'},
        {val:'vice',label:'副 会 长'},{val:'minister',label:'部长/站长'},{val:'broadcaster',label:'广播站员'},
        {val:'etiquette',label:'礼仪队员'},{val:'subleague',label:'团副总支'},{val:'member',label:'志愿者'},{val:'dev',label:'开发人员'}
      ],
      gender:['男','女'],
      nation:['汉族','藏族','彝族','回族','壮族','苗族','羌族','土家族','蒙古族','其他'],
      politics:['群众','共青团员','中共党员','中共预备党员','民盟盟员','无党派人士'],
      religion:['无','佛教','道教','伊斯兰教','天主教','基督教','其他'],
      education:['初中','高中','中专','大专','本科'],
      live:['住校','走读'],
      workExp:['是','否'], acceptMgmt:['是','否'], langQuality:['是','否'],
      departments:['综合高中','财经','电子','航高','机建','现代服务'],
      classes:{
        '综合高中':['24级综合高中1班','24级综合高中2班','25级综合高中1班','25级综合高中2班','25级综合高中3班'],
        '财经':['24级会计1班','24级会计2班','25级会计1班','25级会计2班','25级金融1班','25级金融2班'],
        '电子':['24级电子1班','24级电子2班','25级电子1班','25级电子2班','25级化工1班'],
        '航高':['24级航空1班','24级航空2班','24级航空3班','25级航空1班','25级航空2班','25级航空3班','25级航空4班'],
        '机建':['24级机电1班','24级机电2班','24级机电3班','25级机电1班','25级机电2班'],
        '现代服务':['24级幼保1班','24级幼保2班','25级养护1班','25级养护2班','25级养护3班','25级养护4班']
      },
      organizations:['团委办公室','青年志愿者协会','广播站','礼仪队','团副总支','团总支','学生会','专业团支部'],
      grades:['23级','24级','25级']
    },
    rules:{ scorePerPerson:0.1, deptMultiplier:0.5 },
    services:[],
    activities:[],
    tasks:[],
    news:[],
    notifies:[],
    broadcastRecs:[],
    etiquetteRecs:[],
    subleagueRecs:[],
    quotas:[],
    logs:[], reports:[], summaries:[], traces:[],
    nextIds:{user:200,service:100,activity:10,task:10,news:10,notify:10,summary:10,report:10}
  };
}

function normalizeDB(db){
  if(!db.rules) db.rules={scorePerPerson:0.1,deptMultiplier:0.5};
  if(!db.reports) db.reports=[];
  if(!db.logs) db.logs=[];
  if(!db.traces) db.traces=[];
  if(!db.evaluations) db.evaluations=[];
  if(!db.quotas) db.quotas=[];
  if(!db.others) db.others=[];
  if(!db.nextIds) db.nextIds={};
  /* 演示数据不再自动注入（用户要求纯净系统，自己录入真实数据） */
  const seed=seedDB();
  // 字典增量合并：保留用户已有数据，向 organizations/positions/classes 追加新条目（不覆盖）
  const orgs=new Set([...(db.dictionaries.organizations||[]),...(seed.dictionaries.organizations||[])]);
  db.dictionaries.organizations=[...orgs];
  if(db.dictionaries.classes){
    Object.keys(seed.dictionaries.classes||{}).forEach(dept=>{
      const exist=new Set(db.dictionaries.classes[dept]||[]);
      const inc=new Set(seed.dictionaries.classes[dept]||[]);
      inc.forEach(c=>exist.add(c));
      db.dictionaries.classes[dept]=[...exist];
    });
  }
  // 一次性合并 3 个系统账号（终端管理员 + 校团委管理员 + 开发维护），其他演示账号不再注入；带版本标记避免已删档案复活
  const SYSTEM_IDS=['u-super','u-term','u-dev'];
  if(!db._seedV){
    (seedDB().users||[]).forEach(su=>{ if(SYSTEM_IDS.includes(su.id) && !db.users.some(u=>u.idCard===su.idCard)) db.users.push(su); });
    db._seedV=3;
  }
  // 兜底：移除非系统账号的演示用户（如有遗留 u-prez/u-mem 等），保持纯净
  db.users=(db.users||[]).filter(u=>SYSTEM_IDS.includes(u.id) || (u.pwd && u.idCard && u.name));
  (db.users||[]).forEach(u=>{
    if(!u.grade) u.grade=deriveGrade(u.cls||'');
    if(!u.totpSecret) u.totpSecret=genSecret();
  });
  (db.services||[]).forEach(s=>{ if(!s.grade) s.grade=deriveGrade(s.cls||''); });
  const gs=new Set(db.dictionaries.grades||[]);
  (db.users||[]).forEach(u=>{ if(u.grade) gs.add(u.grade); });
  (db.services||[]).forEach(s=>{ if(s.grade) gs.add(s.grade); });
  db.dictionaries.grades=Array.from(gs).sort();
  return db;
}
function loadDB(){
  if(DB) return DB;
  try{ const s=localStorage.getItem(LS_KEY); if(s){ DB=normalizeDB(JSON.parse(s)); return DB; } }  catch(e){}
  DB = normalizeDB(seedDB()); saveDB(); return DB;
}
function saveDB(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }catch(e){ toast('数据保存失败，请检查浏览器存储空间','err'); } if(window.ZY && DB && !window._zyPushing) try{ ZY.markDirty(); }catch(e){} }
async function resetDB(){
  if(!confirm('确定清除所有数据并恢复到初始纯净状态（不含演示数据）吗？该操作不可恢复，请先导出 Excel 备份！')) return;
  /* 关键：必须等云端三张表真正清空完成，再清本地并刷新；否则刷新会打断清空请求，
     云端仍是旧数据（含已注册身份证），重新登录又被同步拉回，身份证"死灰复燃"被占用 */
  try{
    if(window.ZY){
      try{ if(ZY.stopPoll) ZY.stopPoll(); }catch(e){}
      const c=ZY.cfg, h={'apikey':c.key,'Authorization':'Bearer '+c.key,'Content-Type':'application/json'};
      await fetch(c.url+'/rest/v1/zy_db?id=not.is.null',{method:'DELETE',headers:h});
      await fetch(c.url+'/rest/v1/zy_regs?id=not.is.null',{method:'DELETE',headers:h});
      await fetch(c.url+'/rest/v1/zy_status?id_card=not.is.null',{method:'DELETE',headers:h});
    }
  }catch(e){}
  localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_USR); location.reload();
}
/* 云端同步：零配置，所有用户登录后自动连接（数据自动多设备同步） */
window.initCloudSync=async function(silent){
  try{
    if(!window.ZY) return {ok:false, msg:'同步模块未加载'};
    const bt=await ZY.bootstrap();
    if(bt.ok){
      ZY.startPoll();
      if(!silent&&window.toast) toast(bt.pulled?'已连接云端并载入云端数据（多设备实时同步开启）':'已连接云端，本地数据已上传（多设备实时同步开启）','ok');
      return {ok:true, pulled:!!bt.pulled};
    }
    if(bt.decryptFail){ if(!silent&&window.toast) toast('云端数据解密失败（版本不匹配），请点击「立即上传本地」覆盖云端','err'); }
    else if(!silent&&window.toast) toast('云端同步异常：'+(bt.msg||''),'err');
    return bt;
  }catch(e){
    if(!silent&&window.toast) toast('云端同步异常：'+e.message,'err');
    return {ok:false, msg:e.message};
  }
};
window.stopCloudSync=function(){ if(window.ZY) ZY.stopPoll(); };

/* ============================== 年级 / 动态口令(TOTP) ============================== */
function deriveGrade(cls){const m=(cls||'').match(/(\d+级)/);return m?m[1]:''}
function genSecret(){const a=new Uint8Array(16);(window.crypto&&window.crypto.getRandomValues?window.crypto.getRandomValues.bind(window.crypto):(x=>{for(let i=0;i<x.length;i++)x[i]=Math.floor(Math.random()*256)}))(a);return Array.from(a).map(b=>b.toString( (16) ).padStart(2,'0')).join('')}

/* 纯 JS SHA-1 / HMAC / TOTP（不依赖 crypto.subtle，兼容 file:// 双击打开） */
function sha1(msg){
  function r(v,s){return ((v<<s)|(v>>>(32-s)))>>>0;}
  let h0=1732584193,h1=4023233417,h2=2562383102,h3=271733878,h4=3285377520;
  const data=msg.slice(), ml=data.length*8;
  data.push(0x80); while(data.length%64!==56)data.push(0);
  const lenLo=ml;
  data.push(0,0,0, 0,(lenLo>>>24)&0xff,(lenLo>>>16)&0xff,(lenLo>>>8)&0xff,lenLo&0xff);
  const w=new Array(80);
  for(let i=0;i<data.length;i+=64){
    for(let j=0;j<16;j++)w[j]=((data[i+j*4]<<24)|(data[i+j*4+1]<<16)|(data[i+j*4+2]<<8)|data[i+j*4+3])>>>0;
    for(let j=16;j<80;j++)w[j]=r(w[j-3]^w[j-8]^w[j-14]^w[j-16],1);
    let a=h0,b=h1,c=h2,d=h3,e=h4;
    for(let j=0;j<80;j++){
      let f,k;
      if(j<20){f=(b&c)|((~b)&d);k=1518500249;}
      else if(j<40){f=b^c^d;k=1859775393;}
      else if(j<60){f=(b&c)|(b&d)|(c&d);k=2400959708;}
      else{f=b^c^d;k=3395469782;}
      const tmp=(r(a,5)+(f>>>0)+(e>>>0)+k+(w[j]>>>0))>>>0;
      e=d;d=c;c=r(b,30);b=a;a=tmp;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;
  }
  return [h0,h1,h2,h3,h4];
}
function wordsToBytes(h){
  const b=[];
  h.forEach(x=>{ b.push((x>>>24)&0xff,(x>>>16)&0xff,(x>>>8)&0xff,x&0xff); });
  return b;
}
function hmacSha1(key,msg){
  const block=64;
  let k=key.slice();
  if(k.length>block)k=wordsToBytes(sha1(k));
  while(k.length<block)k.push(0);
  const oKey=new Array(block),iKey=new Array(block);
  for(let i=0;i<block;i++){oKey[i]=k[i]^0x5c;iKey[i]=k[i]^0x36;}
  const inner=wordsToBytes(sha1(iKey.concat(msg)));
  return sha1(oKey.concat(inner));
}
function hexToBytes(h){const a=[];for(let i=0;i<h.length;i+=2)a.push(parseInt(h.substr(i, 2),16));return a}
function computeTOTP(secretHex){
  const t=Math.floor(Date.now()/300000), msg=new Array(8);
  let v=t;for(let i=7;i>=0;i--){msg[i]=v&0xff;v=Math.floor(v/256);}
  const h=hmacSha1(hexToBytes(secretHex),msg);
  const b=[];h.forEach(x=>{b.push((x>>>24)&0xff,(x>>>16)&0xff,(x>>>8)&0xff,x&0xff)});
  const off=b[19]&0x0f;
  const binCalc=(((b[off]&0x7f)<<24)|((b[off+1]&0xff)<<16)|((b[off+2]&0xff)<<8)|(b[off+3]&0xff))>>>0;
  return String(binCalc%1000000).padStart(6,'0');
}

/* ============================== 工具 ============================== */
const $=(s,el)=>(el||document).querySelector(s);
const $$=(s,el)=>Array.from((el||document).querySelectorAll(s));
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function uid(p){return (p||'r')+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function now(){const d=new Date();const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`}
function today(){return now().slice(0,10)}
function fmtDate(s){if(!s)return'';const d=new Date(s);if(isNaN(d))return s;return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function fmtDateTime(s){if(!s)return'';const d=new Date(s);if(isNaN(d))return s;return`${fmtDate(s)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`}
function durationHours(a,b){if(!a||!b)return 0;const x=new Date(a).getTime(),y=new Date(b).getTime();if(isNaN(x)||isNaN(y)||y<=x)return 0;return Math.round(((y-x)/3600000)*10)/10}
function isIDCard(s){return /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(s||'')}

function toast(msg,type){const t=$('#toast');t.className='toast'+(type?' '+type:'');t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{t.hidden=true},4500)}
function openModal(html){const m=document.createElement('div');m.className='mask';m.innerHTML=html;(document.getElementById('modalHost')||document.body).appendChild(m);m.addEventListener('click',e=>{if(e.target===m||e.target.matches('[data-close-modal]'))closeModal()});return m}
function closeModal(){const h=$('#modalHost');if(h)h.innerHTML=''}
function confirmDialog(msg,onYes,title){openModal(`<div class="modal" style="width:380px;"><div class="modal-title"><span class="bar"></span>${esc(title||'确认')}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p style="font-size:14px;line-height:1.8;color:var(--ink-2);">${esc(msg)}</p></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="cfmYes">确认</button></div></div>`);$('#cfmYes').onclick=()=>{closeModal();onYes&&onYes()}}


/* ============================== 角色 ============================== */
const ROLE_RANK={super:100,terminal:100,dev:99,president:80,vice:75,minister:73,broadcaster:72,etiquette:72,subleague:72,member:10};
function canEdit(){return currentUser&&ROLE_RANK[currentUser.role]>=60}
function isSuper(){return currentUser&&currentUser.role==='super'}
function isTerminal(){return currentUser&&currentUser.role==='terminal'}
/* 痕迹日志：仅终端管理员（系统最高权限者）可见；超级管理员（校团委）看不到 */
function canSeeTrace(){return isTerminal();}
function isAdmin(){return currentUser&&(isSuper()||isTerminal())}
function roleLabel(r){const m=(DB.dictionaries.role||[]).find(x=>x.val===r)||{};return m.label||r}
function roleClass(r){return['super','terminal','president','vice','minister','broadcaster','etiquette','subleague','member'].includes(r)?r:'member'}
/* 集成系统模块权限：
   - 会长/副会长/部长/广播站/礼仪队/团副总支 同属管理级（低于超级管理员）
   - 非超级/终端：不显示 数据中心 / 服务与加分 / 报表中心 / 资料打印 / 系统设置 / 操作日志 / 评优评先
   - 各部门仅见本职模块 + 公共模块（首页/活动/任务/新闻/通知/我的/举报/总结/看板） */
function canSee(route){
  if(!currentUser)return false;
  const r=currentUser.role,rank=ROLE_RANK[r]||0,manager=rank>=60;
  const common=['dashboard','activities','tasks','news','notify','my','report','summary','yearKanban','monthKanban'];
  if(common.includes(route))return true;
  if(manager&&['files','audit'].includes(route))return true;
  if(isAdmin()&&['data','service','reports','print','settings','logs','eval'].includes(route))return true;
  if(route==='broadcaster'&&(r==='broadcaster'||isAdmin()))return true;
  if(route==='etiquette'&&(r==='etiquette'||isAdmin()))return true;
  if(route==='subleague'&&(r==='subleague'||isAdmin()))return true;
  if(route==='quota'&&(isAdmin()||manager||currentUser.role==='member'))return true;
  /* 痕迹日志：仅终端管理员（系统最高权限者）可见，超级管理员（校团委）看不到 */
  if(route==='traces')return canSeeTrace();
  /* 操作手册 / 资料文件：所有角色可见（发布权限在界面内按角色控制） */
  if(route==='help'||route==='other')return true;
  /* 终端管理员 = 系统维护者（不录入业务数据，只维护系统/账号/日志），
     故只显示：看板 / 我的档案 / 系统设置 / 痕迹日志 / 操作日志 / 评优评先 / 举报中心；
     业务模块（档案/服务/审核/活动/任务/新闻/通知/部门独立）由校团委/超级管理员操作 */
  if(isTerminal() && !['dashboard','my','settings','traces','logs','eval','report'].includes(route)) return false;
  return false;
}

/* ============================== 路由 ============================== */
function goto(route){location.hash='#'+route}
function currentRoute(){return(location.hash||'').replace(/^#/,'')}

function buildSidebar(){
  const nav=$('#sbNav'),me=currentUser;
  const I=(d)=>'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
  const IC={
    dashboard:I('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
    data:I('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>'),
    files:I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    service:I('<path d="M12 2v4M12 18v4M5 12H1M23 12h-4"/><circle cx="12" cy="12" r="5"/>'),
    reports:I('<path d="M3 21V4a2 2 0 0 1 2-2h4v18H5a2 2 0 0 1-2-2z"/><path d="M9 4h10a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H9"/><path d="M13 9h4M13 13h4M13 17h2"/>'),
    print:I('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="1"/><path d="M6 18h12v3H6z"/>'),
    audit:I('<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M9 12l2 2 4-4"/>'),
    activities:I('<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 9h18M8 3v4M16 3v4"/>'),
    tasks:I('<path d="M3 6h12M3 12h12M3 18h12"/><path d="M19 6l1 1 2-2M19 12l1 1 2-2M19 18l1 1 2-2"/>'),
    news:I('<path d="M4 5h16v13H9l-5 4z"/><path d="M8 9h8M8 12h5"/>'),
    summary:I('<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    notify:I('<path d="M6 8a6 6 0 0 1 12 0c0 6 3 8 3 8H3s3-2 3-8z"/><path d="M10 21a2 2 0 0 0 4 0"/>'),
    broadcaster:I('<path d="M3 11v2a1 1 0 0 0 1 1h2l4 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>'),
    etiquette:I('<path d="M12 3l3 5h5l-4 4 1 6-5-3-5 3 1-6-4-4h5z"/>'),
    subleague:I('<circle cx="12" cy="9" r="4"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>'),
    my:I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>'),
    report:I('<path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/><path d="M12 8v4M12 16h.01"/>'),
    settings:I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    logs:I('<path d="M3 6h13M3 12h13M3 18h13M19 6l3 3-3 3M19 12h2M19 18l3 3-3 3"/>'),
    traces:I('<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="1.5"/>'),
    help:I('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r=".5"/>'),
    other:I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M13 12h4M13 15h4M9 12h.01M9 15h.01"/>'),
    eval:I('<circle cx="12" cy="8" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/><circle cx="12" cy="8" r="2"/>')
  };
  const all=[
    {k:'dashboard',name:'总控看板',ico:IC.dashboard},
    {k:'data',name:'数据中心',ico:IC.data},
    {k:'files',name:'档案中心',ico:IC.files},
    {k:'service',name:'服务与加分',ico:IC.service},
    {k:'reports',name:'报表中心',ico:IC.reports},
    {k:'print',name:'资料打印',ico:IC.print},
    {k:'audit',name:'审核中心',ico:IC.audit},
    {k:'activities',name:'活动中心',ico:IC.activities},
    {k:'tasks',name:'任务中心',ico:IC.tasks},
    {k:'news',name:'新闻·通报',ico:IC.news},
    {k:'summary',name:'月度总结',ico:IC.summary},
    {k:'notify',name:'通知中心',ico:IC.notify},
    {k:'other',name:'资料文件',ico:IC.other},
    {k:'yearKanban',name:'年度看板',ico:IC.dashboard},
    {k:'monthKanban',name:'月度看板',ico:IC.dashboard},
    {k:'broadcaster',name:'广播部管理',ico:IC.broadcaster},
    {k:'etiquette',name:'礼仪队管理',ico:IC.etiquette},
    {k:'subleague',name:'团副总支',ico:IC.subleague},
    {k:'quota',name:'团员名额',ico:IC.eval},
    {k:'my',name:'我的档案',ico:IC.my},
    {k:'report',name:'举报中心',ico:IC.report},
    {k:'settings',name:'系统设置·换届',ico:IC.settings},
    {k:'traces',name:'痕迹日志',ico:IC.traces},
    {k:'logs',name:'操作日志',ico:IC.logs},
    {k:'eval',name:'评优评先',ico:IC.eval},
    {k:'help',name:'操作手册',ico:IC.help}
  ].filter(it=>canSee(it.k));
  const groups=[
    {title:'总 览',items:all.filter(i=>['dashboard','data'].includes(i.k))},
    {title:'志愿管理',items:all.filter(i=>['files','service','reports','print','audit'].includes(i.k))},
    {title:'业务中心',items:all.filter(i=>['activities','tasks','news','summary','yearKanban','monthKanban','notify','other'].includes(i.k))},
    {title:'部门独立',items:all.filter(i=>['broadcaster','etiquette','subleague','quota'].includes(i.k))},
    {title:'个人',items:all.filter(i=>['my','report'].includes(i.k))},
    {title:'系统',items:all.filter(i=>['settings','traces','logs','eval','help'].includes(i.k))}
  ].filter(g=>g.items.length);

  nav.innerHTML=groups.map(g=>`<div class="group-title">${esc(g.title)}</div>${g.items.map(it=>`<a data-route="${it.k}" class="${currentRoute()===it.k?'active':''}">${it.ico||''}<span>${esc(it.name)}</span></a>`).join('')}`).join('');
  $$('#sbNav a').forEach(a=>a.onclick=()=>goto(a.dataset.route));
  $('#sbName').textContent=me.name; $('#sbRole').textContent=roleLabel(me.role); $('#sbAvatar').innerHTML='<img src="logo.png" alt="" style="width:100%;height:100%;object-fit:contain;padding:3px;">';
}
function buildTopbar(){
  const tbNav=$('#tbNav');
  const items=[
    {k:'dashboard',name:'首页'},{k:'activities',name:'活动中心'},{k:'news',name:'信息动态'},
    {k:'tasks',name:'任务中心'},{k:'data',name:'数据中心'},{k:'summary',name:'月度总结'},{k:'audit',name:'审核中心'}
  ].filter(it=>canSee(it.k));
  tbNav.innerHTML=items.map(it=>`<a data-nav="${it.k}" class="${currentRoute()===it.k?'active':''}">${esc(it.name)}</a>`).join('');
  $$('#tbNav a').forEach(a=>a.onclick=()=>goto(a.dataset.nav));
  $('#tbUname').textContent=currentUser.name; $('#tbAvatar').textContent=(currentUser.name||'?').slice(0,1);
}
function highlightNav(){
  $$('#sbNav a').forEach(a=>a.classList.toggle('active',a.dataset.route===currentRoute()));
  $$('#tbNav a').forEach(a=>a.classList.toggle('active',a.dataset.nav===currentRoute()));
}

/* 全局过滤（专业部 / 年级 / 关键字） */
let gFilter={dept:'',grade:'',kw:''};
function passFilter(item){
  if(gFilter.dept && item.dept && item.dept!==gFilter.dept) return false;
  if(gFilter.grade && item.grade && item.grade!==gFilter.grade) return false;
  if(gFilter.kw){
    const k=gFilter.kw.toLowerCase();
    const hay=[item.name,item.idCard,item.cls,item.title].filter(Boolean).join(' ').toLowerCase();
    if(!hay.includes(k)) return false;
  }
  return true;
}
function initFilters(){
  const fd=$('#gfDept'),fg=$('#gfGrade'); if(!fd)return;
  if(!fd.dataset.ready){
    fd.innerHTML='<option value="">全部专业部</option>'+DB.dictionaries.departments.map(d=>`<option value="${d}">${d}</option>`).join('');
    fg.innerHTML='<option value="">全部年级</option>'+DB.dictionaries.grades.map(g=>`<option value="${g}">${g}</option>`).join('');
    fd.onchange=()=>{gFilter.dept=fd.value; renderRoute();};
    fg.onchange=()=>{gFilter.grade=fg.value; renderRoute();};
    $('#gfKw').addEventListener('keydown',e=>{if(e.key==='Enter'){$('#gfSearch').click()}});
    $('#gfSearch').onclick=()=>{
      gFilter.kw=$('#gfKw').value.trim();
      // 身份证精确匹配 18 位 → 弹出该人"人员全景"
      if(gFilter.kw.length===18 && /^\d{17}[\dXx]$/.test(gFilter.kw)){
        const m=DB.users.find(u=>u.idCard===gFilter.kw);
        if(m){ showProfile(m.id); return; }
      }
      if(currentRoute()!=='files'){ goto('files'); setTimeout(()=>{const f=document.getElementById('fKw'); if(f)f.value=gFilter.kw; if(currentRoute()==='files')filesSearch();},40); }
      else{ renderRoute(); }
    };
    fd.dataset.ready='1';
  }
  fd.value=gFilter.dept; fg.value=gFilter.grade; $('#gfKw').value=gFilter.kw;
}

/* ============================== 登录/注册/退出 ============================== */
function renderApp(){
  $('#app').hidden=false; $('#loginPage').style.display='none';
  buildSidebar(); buildTopbar(); initFilters();
  $('#mainDate').textContent=fmtDate(now())+'  '+new Date().toLocaleTimeString('zh-CN',{hour12:false}); $('#mainPeriod').textContent=DB.period;
  renderRoute(); updateNotifyBadge();
  updateNotifyBadge();
  /* 部署状态 banner：前端已永久部署，数据同步状态实时呈现（让用户一眼看清进度） */
  const sb=$('#syncBanner');if(sb){
    const dismissed=DB.settings&&DB.settings.syncBannerDismissed;
    sb.hidden=!!dismissed;
    const close=()=>{sb.hidden=true;DB.settings=DB.settings||{};DB.settings.syncBannerDismissed=true;saveDB()};
    const closeBtn=$('#syncBannerClose');if(closeBtn)closeBtn.onclick=close;
    const dismissBtn=$('#syncBannerDismiss');if(dismissBtn)dismissBtn.onclick=close;
    const moreBtn=$('#syncBannerMore');if(moreBtn)moreBtn.onclick=openCloudUpgradeModal;
  }
  /* 云端同步：仅管理角色同步全量数据（普通成员只走审核状态通道，不持有全量密文，防信息泄露） */
  const cr=currentUser&&currentUser.role;
  const isMgr=cr==='super'||cr==='terminal'||cr==='president'||cr==='vice'||cr==='minister'||cr==='broadcaster'||cr==='etiquette'||cr==='subleague'||cr==='dev';
  if(isMgr && window.ZY){
    try{ initCloudSync(true); }catch(e){}
  }
}
window.openCloudUpgradeModal=function(){
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>升级到云端同步（解锁全部需求）<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    <p class="warn" style="margin-bottom:14px;font-weight:600;color:var(--red);">当前为 localStorage 单机版，以下功能受限：换设备看不到数据、清缓存即全部丢失、注册审核与通知无法跨设备联动、密码本地明文存储、沙箱地址非永久、所有人能访问的稳定 URL 无法提供。</p>
    <div style="line-height:1.95;font-size:14px;color:var(--ink-2);">
      <div style="font-weight:600;color:var(--red);margin:8px 0 6px;">升级后获得：</div>
      <div>1. <b>全设备实时同步</b>：手机/电脑/平板任一设备操作，其它设备秒级同步</div>
      <div>2. <b>真永久地址</b>：数据存放在云端数据库，平台自带稳定域名（不再有缓存戳 ?v=N）</div>
      <div>3. <b>注册/审核/通知实时联动</b>：手机端申请、电脑端秒收审核提醒</div>
      <div>4. <b>密码 bcrypt 加密 + JWT 鉴权</b>：彻底告别本地明文存储，信息安全合规</div>
      <div>5. <b>服务端权限过滤</b>：志愿者协会下级宣传部等只能看自己部门，从根上防信息泄露</div>
      <div>6. <b>所有人可访问</b>：公开访问入口，无需安装、无需 Node 环境</div>
      <div style="font-weight:600;color:var(--red);margin:14px 0 6px;">如何解锁：</div>
      <div>① 打开 WorkBuddy 客户端右上角 <b>「设置 → 连接器管理」</b></div>
      <div>② 找到 <b>「腾讯云 CloudBase」</b>（cloudbase）</div>
      <div>③ 点击 <b>「连接 / 授权」</b>，按弹窗完成实名认证（一次性，永久有效）</div>
      <div>④ 回到本系统回复我 <b>"已授权"</b>，我立即开启 P1 云端迁移（约 30 分钟内一次性完成）</div>
    </div>
    <div class="tip-line mt-16" style="font-size:12px;color:var(--ink-3);">迁移过程中：① 在云端搭建云环境+云函数+云数据库；② 把当前 8 大数据字典迁到云数据库；③ 前端切到云函数调用；④ 启用服务端鉴权；⑤ 发布到真永久地址。</div>
  </div><div class="modal-foot"><button class="ghost" data-close-modal>稍后再说</button><button class="primary" onclick="closeModal();window.open('https://www.workbuddy.cn/docs/workbuddy/Overview','_blank')">前往 WorkBuddy 设置</button></div></div>`);
};
function startClock(sel){const upd=()=>{const el=$(sel);if(!el)return;const d=new Date();el.textContent=fmtDate(now())+'  '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0')};upd();setInterval(upd,1000)}

function bindLogin(){
  const preset={super:['000000000000000001','admin123'],terminal:['000000000000000002','term123'],president:['000000000000000003','prez123'],vice:['000000000000000004','vice123'],minister:['000000000000000005','min123'],broadcaster:['000000000000000006','bc123'],etiquette:['000000000000000007','et123'],subleague:['000000000000000008','sl123'],member:['000000000000000009','mem123'],dev:['000000000000000099','dev123']};
  $$('.quick-grid button').forEach(b=>{b.onclick=()=>{const p=preset[b.dataset.role];if(p){$('#loginId').value=p[0];$('#loginPwd').value=p[1]}}});
  $('#eyeToggle').onclick=()=>{const i=$('#loginPwd');if(i.type==='password'){i.type='text';$('#eyeToggle').textContent='隐藏'}else{i.type='password';$('#eyeToggle').textContent='显示'}};
  drawCaptcha();
  $('#captchaBox').onclick=drawCaptcha;
  $('#btnLogin').onclick=doLogin;
  $('#goRegister').onclick=openRegister;
  $('#goForgot').onclick=()=>{$('#forgotModal').hidden=false};
  $('#btnRegSubmit').onclick=doRegister;
  $('#btnForgotSubmit').onclick=doForgot;
  $('#btnLogout').onclick=()=>confirmDialog('确认退出当前账号？',doLogout);
  $('#tbMsg').onclick=()=>{$('#notifyDrawer').hidden=false;renderNotifyList('all')};
  $$('#notifyDrawer .dp-tabs button').forEach(b=>b.onclick=()=>{$$('#notifyDrawer .dp-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderNotifyList(b.dataset.ntab)});
  $$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).hidden=true);
  $$('[data-close-drawer]').forEach(b=>b.onclick=()=>$('#'+b.dataset.closeDrawer).hidden=true);
  window.addEventListener('hashchange',renderRoute);
  /* 刷新/关闭页面前强制把本地数据推到云端（防止刷新时云端旧数据覆盖本地） */
  window.addEventListener('pagehide',()=>{ try{ if(window.ZY&&window.DB) ZY.markDirty(); }catch(e){} });
}
function flushCloudNow(){ try{ if(window.ZY&&window.DB) ZY.markDirty(); }catch(e){} }
window.flushCloudNow=flushCloudNow;

function showWelcome(name){
  const ico='<svg viewBox="0 0 24 24" width="46" height="46"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" fill="#c8161d"/><path d="M8 11l3 3 5-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const m=document.createElement('div');m.className='mask';
  m.innerHTML=`<div class="modal" style="max-width:380px"><div class="modal-title"><span class="bar"></span>欢迎<span class="bar"></span><button class="x" data-wclose>×</button></div><div class="modal-body" style="text-align:center;padding:30px 24px"><div style="display:flex;justify-content:center;margin-bottom:8px">${ico}</div><div style="font-size:18px;font-weight:600;color:#c8161d">${esc(name)}，欢迎回到志愿服务平台！</div><div style="color:#888;margin-top:8px;font-size:13px">${fmtDate(now())} · ${esc(DB.period)}</div><div style="margin-top:20px"><button class="primary" data-wclose>进入系统</button></div></div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{if(e.target===m||e.target.matches('[data-wclose]'))m.remove()});
}
function doLogin(){
  const id=$('#loginId').value.trim(),pwd=$('#loginPwd').value,cap=$('#loginCaptcha').value.trim();
  if(!id||!pwd)return toast('请填写身份证号和登录密码','err');
  if(!cap)return toast('请输入验证码','err');
  if(!checkCaptcha(cap)){toast('验证码错误，请重新输入','err');drawCaptcha();$('#loginCaptcha').value='';return}
  let u=DB.users.find(x=>x.idCard===id&&x.pwd===pwd);
  if(!u){
    /* 本机无该用户：可能云端有（新设备首次登录 / 他端注册后本机未同步），先拉云端核对 */
    if(window.ZY && ZY.pull){
      return ZY.pull(true).then(p=>{
        if(p.ok && p.data && Array.isArray(p.data.users)){
          const cu=p.data.users.find(x=>x.idCard===id&&x.pwd===pwd);
          if(cu){
            const ex=DB.users.find(x=>x.idCard===id);
            if(!ex) DB.users.push(cu); else Object.assign(ex,cu);
            saveDB();
            if(cu.activated===true){ doEnter(cu); return; }
            if(cu.activated===false && cu.pending){ toast('账号未激活：注册申请正在审核中，请稍后再试','err'); return; }
            toast('账号未激活，请联系管理员','err'); return;
          }
        }
        toast('身份证号或密码不正确','err');
      }).catch(()=>{ toast('身份证号或密码不正确','err'); });
    }
    return toast('身份证号或密码不正确','err');
  }
  if(u.activated===false){
    /* v18.24 起审核结果通过 ZY.push 整库上云（不再写 zy_status 表）。
       登录时强制拉取云端主库最新状态，核对 activated，审核通过则直接激活登录。 */
    if(window.ZY && ZY.pull){
      return ZY.pull(true).then(p=>{
        if(p.ok && p.data && Array.isArray(p.data.users)){
          const cu=p.data.users.find(x=>x.idCard===id);
          if(cu && cu.activated===true){
            u.activated=true; u.pending=false; u.status=u.status||'正常在岗'; saveDB();
            pushLog('注册',`${u.name} 注册已审核通过，账号自动激活`);
            toast('审核已通过！欢迎加入','ok'); doEnter(u); return;
          }
        }
        if(u.pending) toast('账号未激活：注册申请正在审核中，请稍后再试','err');
        else toast('账号未激活，请联系管理员','err');
      }).catch(()=>{
        if(u.pending) toast('账号未激活：注册申请正在审核中，请稍后再试','err');
        else toast('账号未激活，请联系管理员','err');
      });
    }
    return toast(u.pending?'账号未激活：注册申请正在审核中，请稍后再试':'账号未激活，请联系管理员','err');
  }
  doEnter(u);
}
function doEnter(u){
  currentUser=u; localStorage.setItem(LS_USR,u.id);
  pushLog('登录',`${u.name} 登录`);
  toast('登录成功','ok');
  $('#loginPwd').value='';$('#loginCaptcha').value='';drawCaptcha();
  try{ renderApp(); }catch(err){ console.error('renderApp 失败:', err); toast('已进入主界面但渲染异常: '+err.message,'err'); }
  setTimeout(()=>showWelcome(u.name),150);
}

/* 登录验证码 */
let captchaValue='';
function captchaText(){
  const ch='23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let s='';
  for(let i=0;i<4;i++)s+=ch[Math.floor(Math.random()*ch.length)];
  return s;
}
function drawCaptcha(){
  captchaValue=captchaText();
  const box=$('#captchaBox');
  if(!box)return;
  /* 稳健渲染：4 个字符独立染色 + 轻微 letter-spacing，去掉 transform 旋转（避免被部分浏览器/CSS 引擎忽略导致整行不可见） */
  const colors=['#c8161d','#1d5fa6','#2a8a3a','#d46b08'];
  box.innerHTML=captchaValue.split('').map((c,i)=>`<span style="color:${colors[i%4]};font-weight:900;">${c}</span>`).join('');
  /* 兜底：若高度仍为 0，强制可见 */
  if(box.offsetHeight<10){
    box.style.minHeight='36px';box.style.display='inline-flex';box.style.alignItems='center';
  }
}
function checkCaptcha(v){return (v||'').toUpperCase()===captchaValue.toUpperCase()}

function openRegister(){
  $('#registerForm').innerHTML=`
    <label>姓名<i>*</i><input id="rName"></label>
    <label>身份证号<i>*</i><input id="rIdCard" maxlength="18"></label>
    <label>性别<select id="rGender"><option>男</option><option>女</option></select></label>
    <label>出生年月<input id="rBirth" type="date"></label>
    <label>民族<select id="rNation">${(DB.dictionaries.nation||[]).map(n=>`<option ${n==='汉族'?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>政治面貌<select id="rPolitics">${(DB.dictionaries.politics||[]).map(n=>`<option>${n}</option>`).join('')}</select></label>
    <label>宗教信仰<select id="rReligion">${(DB.dictionaries.religion||[]).map(n=>`<option>${n}</option>`).join('')}</select></label>
    <label>所在学校<input id="rSchool" value="${esc(DB.school)}"></label>
    <label>专业部<select id="rDept"><option value="">请选择</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></label>
    <label>班级<input id="rCls" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label>所在部门<i>*</i><select id="rOrg"><option value="">请选择部门</option>${(DB.dictionaries.organizations||[]).map(d=>`<option>${d}</option>`).join('')}</select></label>
    <label>职位/类型<select id="rType"><option>青年志愿者</option><option>广播站成员</option><option>礼仪队成员</option><option>团总支成员</option></select></label>
    <label>登录密码<i>*</i><input id="rPwd" type="password"></label>
    <label>确认密码<i>*</i><input id="rPwd2" type="password"></label>
    <label>联系电话<input id="rPhone"></label>
    <label>电子邮件<input id="rEmail" type="email"></label>
    <label>QQ（选填）<input id="rQQ"></label>
    <label>微信号（选填）<input id="rWechat"></label>
    <label>籍贯<input id="rNative"></label>
    <label>居住地址<input id="rAddr"></label>
    <label>证件照（白底二寸）<input id="rPhoto" type="file" accept="image/*"></label>
    <label>个人简历/经历<textarea id="rExp"></textarea></label>`;
  $('#registerModal').hidden=false;
}

function doRegister(){
  const id=$('#rIdCard').value.trim(),name=$('#rName').value.trim(),pwd=$('#rPwd').value,pwd2=$('#rPwd2').value;
  if(!isIDCard(id))return toast('身份证号格式不正确','err');
  if(!name)return toast('请填写姓名','err');
  if(pwd.length<6)return toast('密码至少 6 位','err');
  if(pwd!==pwd2)return toast('两次密码输入不一致','err');
  const org=$('#rOrg').value.trim();
  if(!org)return toast('请选择所在部门','err');
  const existUser=DB.users.find(u=>u.idCard===id);
  if(existUser) return toast(existUser.pending?'该身份证号已提交注册，正在审核中':'该身份证号已注册','err');
  const photo=$('#rPhoto').files[0];
  const finish=(avatar)=>{
    const next=(DB.nextIds.user=(DB.nextIds.user||0)+1);
    DB.users.push({id:'u-'+next,idCard:id,pwd,role:'member',org,name,gender:$('#rGender').value,birth:$('#rBirth').value,nation:$('#rNation').value,politics:$('#rPolitics').value,religion:$('#rReligion').value,school:$('#rSchool').value,dept:$('#rDept').value,cls:$('#rCls').value,grade:deriveGrade($('#rCls').value),phone:$('#rPhone').value,email:$('#rEmail').value,qq:$('#rQQ').value,wechat:$('#rWechat').value,native:$('#rNative').value,addr:$('#rAddr').value,title:$('#rType').value,avatar,exp:$('#rExp').value,position:'志愿者',activated:false,pending:true,createdAt:now()});
    saveDB();
    pushLog('注册',`新注册 ${name}，待审核`);
    /* 按部门分流通知：本部门管理员才能收到审核通知，超级/终端管理员可收到全部 */
    const auditTargets=auditNotifyTargets(org);
    pushNotify({to:auditTargets,org,kind:'audit',title:`【${org}】新注册待审核`,content:`${name} 申请加入「${org}」，请本部门管理员审核`});
    /* 整库同步上云：pending 用户 + 审核通知一并同步，管理员端拉取后立即出现在审核中心、通知中心角标实时变化（统一走 ZY 零配置同步，不再走割裂的 zy_regs 双通道） */
    if(window.ZY){ ZY.push().catch(()=>{}); }
    toast('注册成功！已同步云端，请等待本部门管理员审核','ok');$('#registerModal').hidden=true;
  };
  if(photo){const r=new FileReader();r.onload=()=>finish(r.result);r.readAsDataURL(photo)}else finish('');
}

function doForgot(){
  const id=$('#fId').value.trim(),name=$('#fName').value.trim(),key=$('#fKey').value.trim(),p1=$('#fPwd1').value,p2=$('#fPwd2').value;
  if(!isIDCard(id))return toast('身份证号不正确','err');
  if(p1.length<6)return toast('新密码至少 6 位','err');
  if(p1!==p2)return toast('两次密码输入不一致','err');
  const u=DB.users.find(x=>x.idCard===id);
  if(!u)return toast('该身份证号未注册','err');
  if(key){
    if(computeTOTP(u.totpSecret)!==key) return toast('动态口令错误，请核对后重试','err');
  }else{
    if(!name)return toast('请填写姓名，或使用动态口令','err');
    if(u.name!==name)return toast('身份证号 + 姓名不匹配','err');
  }
  u.pwd=p1; saveDB(); pushLog('重置密码',`${u.name} 通过${key?'动态口令':'姓名'}重置密码`);
  toast('密码已重置，请用新密码登录','ok');$('#forgotModal').hidden=true;
}

function doLogout(){localStorage.removeItem(LS_USR);toast('已退出登录','ok');location.reload()}
function pushLog(action,content){DB.logs.unshift({id:uid('l'),time:now(),user:currentUser?currentUser.name:'-',role:currentUser?currentUser.role:'-',action,content});if(DB.logs.length>1000)DB.logs.length=1000;saveDB()}
/* 痕迹日志：记录数据级操作（前后值差异），仅终端管理员（系统最高权限者）可见
 * action: 操作类型 如 "审核通过"、"修改档案"、"任命"、"注销"
 * target: 操作对象 "user档案:张三"、"活动:五四诵唱"
 * before/after: 改前/改后快照（自动 JSON.stringify 比较）
 * hint: 额外描述（可选） */
window.pushTrace=function(action,target,before,after,hint){
  try{
    if(!canSeeTrace()) return; /* 非痕迹日志可见角色不记录（节省） */
    const t={id:uid('tr'),time:now(),user:currentUser?currentUser.name:'-',role:currentUser?currentUser.role:'-',action,target,hint:hint||'',before:JSON.stringify(before||{}).slice(0,4000),after:JSON.stringify(after||{}).slice(0,4000)};
    DB.traces=DB.traces||[]; DB.traces.unshift(t);if(DB.traces.length>2000)DB.traces.length=2000;saveDB();
  }catch(e){}
};
/* 支持 to 为数组（同时通知多个角色，如 超级管理员/终端管理员/会 长）；数组化后每条通知只挂一个 to，适配通知中心按 roleLabel 过滤 */
function pushNotify(o){
  const toArr=Array.isArray(o.to)?o.to:[o.to];
  toArr.forEach(t=>{ DB.notifies.unshift(Object.assign({id:uid('nt'),time:now(),unread:true,pending:true},o,{to:t})); });
  saveDB();updateNotifyBadge();
}

/* 注册审核按部门分流：哪个部门的成员注册，只通知该部门管理员（含超级/终端可览全部） */
function auditNotifyTargets(org){
  const base=['超级管理员','终端管理员'];
  if(org==='青年志愿者协会') base.push('会 长','副 会 长','部长/站长');
  else if(org==='广播站') base.push('广播站员','部长/站长');
  else if(org==='礼仪队') base.push('礼仪队员','部长/站长');
  else if(org==='团副总支') base.push('团副总支','部长/站长');
  else base.push('部长/站长');
  return base;
}
/* 当前管理员能否审核/查看某条注册/通知：超级/终端看全部；部门管理员只看本部门 */
function canAuditUser(u){ return isAdmin() || (currentUser && currentUser.org && u && u.org===currentUser.org); }
function canSeeNotify(n){
  if(!currentUser)return false;
  const toMe=n.to==='all'||n.to===currentUser.name||n.to===roleLabel(currentUser.role);
  if(!toMe)return false;
  if(!n.org || isAdmin() || currentUser.org===n.org || n.to===currentUser.name)return true;
  return false;
}

function badgeText(n){
  if(!n) return '';
  if(n<=9) return String(n);
  if(n<=99) return '9+';
  return '99+';
}
function notifyKindLabel(k){
  return ({audit:'待审核',act:'活动',task:'任务',news:'新闻',sys:'系统',quota:'名额',summary:'总结',reg:'注册'}[k]||'通知');
}
function updateNotifyBadge(){
  if(!currentUser)return;
  const unread=DB.notifies.filter(n=>n.unread===true&&canSeeNotify(n)).length;
  const b=$('#tbMsgBadge');if(b){
    b.textContent=badgeText(unread);
    b.style.display=unread?'inline-flex':'none';
    b.title=unread>9?`${unread} 条未读`:'';
  }
}
function renderNotifyList(tab){
  const box=$('#notifyList');if(!box)return;
  let list=DB.notifies.filter(canSeeNotify);
  if(tab==='unread')list=list.filter(n=>n.unread===true);
  else if(tab==='sys')list=list.filter(n=>n.kind==='sys');
  else if(tab==='act')list=list.filter(n=>n.kind==='act'||n.kind==='task');
  else if(tab==='audit')list=list.filter(n=>n.kind==='audit'||n.kind==='reg');
  // 待处理排序：待处理 + 未读 优先置顶
  list=list.slice().sort((a,b)=>{
    const ap=(a.unread&&a.pending)?1:0, bp=(b.unread&&b.pending)?1:0;
    if(ap!==bp) return bp-ap;
    return String(b.time||'').localeCompare(String(a.time||''));
  });
  if(!list.length){box.innerHTML='<div class="empty-tip">暂无通知</div>';return}
  const routeMap={audit:'audit',act:'activities',task:'tasks',news:'news',sys:'dashboard',reg:'audit',quota:'quota',summary:'summary'};
  box.innerHTML=list.map(n=>{
    const r=routeMap[n.kind]||'dashboard';
    const pending=(n.unread&&n.pending);
    return`<div class="notify-item ${n.unread?'unread':''} ${pending?'pending':'handled'}" onclick="goNotify('${n.id}','${r}')">
      <div class="ti">${pending?'<span class="dot-pending" title="待处理"></span>':''}<span class="kind kind-${esc(n.kind||'sys')}">${esc(notifyKindLabel(n.kind))}</span>${esc(n.title)}<time>${esc(fmtDateTime(n.time))}</time></div>
      <div class="ct">${esc(n.content)}</div>
      <div class="meta">
        ${pending?'<span class="badge-pending">待处理</span>':'<span class="badge-handled">已读</span>'}
        <span class="go">查看详情 ›</span>
      </div>
    </div>`;
  }).join('');
}
window.handleNotify=function(id,route){
  const n=DB.notifies.find(x=>x.id===id);if(n){n.unread=false;n.pending=false;saveDB();updateNotifyBadge();}
  $('#notifyDrawer').hidden=true;goto(route||'dashboard');
};
window.goNotify=(id,route)=>handleNotify(id,route);

const PAGE_TITLES={dashboard:'总控看板',files:'档案中心',service:'服务与加分',reports:'报表中心',print:'资料打印',audit:'审核中心',activities:'活动中心',tasks:'任务中心',news:'新闻·通报',summary:'月度总结',notify:'通知中心',data:'数据中心',broadcaster:'广播部管理',etiquette:'礼仪队管理',subleague:'团副总支',settings:'系统设置·换届',my:'我的档案',report:'举报中心',logs:'操作日志',traces:'痕迹日志',eval:'评优评先',yearKanban:'年度看板',monthKanban:'月度看板',quota:'团员名额',help:'操作手册',other:'资料文件'};
function renderRoute(){
  if(!currentUser)return;
  highlightNav();
  const map={'':renderDashboard,'dashboard':renderDashboard,'files':renderFiles,'service':renderService,'reports':renderReports,'print':renderPrint,'audit':renderAudit,'activities':renderActivities,'tasks':renderTasks,'news':renderNews,'summary':renderSummary,'notify':renderNotify,'data':renderData,'broadcaster':renderBroadcaster,'etiquette':renderEtiquette,'subleague':renderSubleague,'settings':renderSettings,'my':renderMy,'report':renderReport,'logs':renderLogs,'traces':renderTraces,'eval':renderEval,'yearKanban':renderYearKanban,'monthKanban':renderMonthKanban,'quota':renderQuota,'help':renderHelp,'other':renderOther};
  let cr=currentRoute();
  if(!canSee(cr)) cr='dashboard';
  const fn=map[cr]||renderDashboard;
  const root=$('#viewRoot');root.innerHTML='';fn(root);
  const crumb=$('#crumbs');if(crumb)crumb.textContent=PAGE_TITLES[cr]||'总控看板';
}
function blockHead(title,ops){return `<div class="block-head"><div class="title">${title}</div><div class="ops">${ops||''}</div></div>`}
function chartFont(){return{family:'Microsoft YaHei',size:12}}

/* ============================== 总控看板 ============================== */
function renderDashboard(root){
  const totalMembers=DB.users.filter(u=>u.role==='member').length;
  const managerCount=DB.users.filter(u=>u.role!=='member'&&u.role!=='dev').length;
  const totalHours=DB.services.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0);
  const stats=[
    {label:'志愿者总数',value:totalMembers,unit:'人',sub:`含 ${managerCount} 位管理员`,icon:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21c0-3.3 3.1-6 7-6s7 2.7 7 6"/><path d="M14 21c0-2.5 1.5-4.5 5-4.5s5 2 5 4.5"/></svg>',cls:'ic-red'},
    {label:'本期服务人次',value:DB.services.length,unit:'人次',sub:'包含全部部门活动',icon:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h4l2 2 3-4 3 4 2-2h4"/><path d="M3 11v4a2 2 0 0 0 2 2h2"/><path d="M21 11v4a2 2 0 0 1-2 2h-2"/></svg>',cls:'ic-red'},
    {label:'累计服务时长',value:totalHours.toFixed(1),unit:'小时',sub:'所有志愿服务时长',icon:'<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.5 4.5 4.5 0 0 1 8 2.5c0 6.5-8 11-8 11z"/></svg>',cls:'ic-red'},
    {label:'专业部数量',value:(DB.dictionaries.departments||[]).length,unit:'个',sub:'可在系统设置自定义',icon:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></svg>',cls:'ic-red'},
    {label:'开展活动数',value:DB.activities.length,unit:'场',sub:'含已完成与招募中',icon:'<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l9 6-9 3-9-3z"/><path d="M3 9v10h18V9"/><path d="M12 12v7"/></svg>',cls:'ic-red'}
  ];
  const bCast=(DB.broadcastRecs||[]),etiq=(DB.etiquetteRecs||[]),subl=(DB.subleagueRecs||[]);
  const perfCardsData=[{name:'青年志愿者协会',n:DB.services.length,unit:'服务人次',sub:'时长 '+totalHours.toFixed(1)+' h',bar:'#c8161d'},{name:'广播站',n:bCast.length,unit:'广播条数',sub:'播音 '+bCast.reduce((s,x)=>s+(+x.minutes||0),0)+' 分钟',bar:'#e6333a'},{name:'礼仪队',n:etiq.length,unit:'礼仪场次',sub:'覆盖各类校园活动',bar:'#a30e16'},{name:'团副总支',n:subl.length,unit:'组织生活',sub:'参与 '+subl.reduce((s,x)=>s+(+x.count||0),0)+' 人次',bar:'#80070e'}];
  const perfCards=perfCardsData.map(p=>`<div class="perf-card"><div class="perf-bar" style="background:${p.bar}"></div><div class="perf-meta"><div class="perf-name">${esc(p.name)}</div><div class="perf-val">${p.n}<span>${esc(p.unit)}</span></div><div class="perf-sub">${esc(p.sub)}</div></div></div>`).join('');
  const isAdminLog=['super','terminal','dev'].includes(currentUser.role);
  const logSection=isAdminLog?`<div class="page-block">${blockHead('系统操作动态（最新）','<button onclick="goto(\'logs\')">查看全部</button>')}<div class="block-body"><table class="tbl"><thead><tr><th>时间</th><th>操作人</th><th>操作类型</th><th>内容</th></tr></thead><tbody>${(DB.logs||[]).slice(0,8).map(l=>`<tr><td>${esc(fmtDateTime(l.time))}</td><td>${esc(l.user)}</td><td><span style="background:var(--red-soft);color:var(--red);padding:2px 8px;border-radius:4px;font-size:12px;">${esc(l.action)}</span></td><td>${esc(l.content)}</td></tr>`).join('')}</tbody></table></div></div>`:'';
  const pinned=DB.news.filter(n=>n.priority==='置顶');
  const recentNews=DB.news.slice().sort((a,b)=>String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0,6);
  const recentActs=DB.services.slice(-6).reverse();
  const actSnap=DB.activities.slice(0,6);
  const recentTasks=DB.tasks.slice(0,4);

  root.innerHTML=`
    <div class="notice-strip"><span class="label">系统公告</span><span class="ct">欢迎进入 <b>宣汉职校志愿服务智慧管理平台</b>；今日 ${fmtDate(now())} · ${esc(DB.period)} · ${esc(DB.school)}</span><span class="time">单机版 · 即开即用</span></div>
    <div class="stat-row">${stats.map(s=>`<div class="stat-card"><div class="stat-icon ${s.cls}">${s.icon}</div><div class="stat-meta"><div class="stat-label">${esc(s.label)}</div><div class="stat-value">${s.value}<span class="unit">${esc(s.unit)}</span></div><div class="stat-sub">${esc(s.sub)}</div></div></div>`).join('')}</div>
    <div class="page-block" id="carouselBlock">${blockHead('','')}<div class="block-body" style="padding:0;">
      <div class="hero-carousel" id="heroCarousel">
        <div class="hc-track" id="hcTrack">
          <div class="hc-slide" data-i="1"><img src="carousel/carousel-1.jpg" alt="志愿风采 1"></div>
          <div class="hc-slide" data-i="2"><img data-src="carousel/carousel-2.jpg" alt="志愿风采 2"></div>
          <div class="hc-slide" data-i="3"><img data-src="carousel/carousel-3.jpg" alt="志愿风采 3"></div>
          <div class="hc-slide" data-i="4"><img data-src="carousel/carousel-4.jpg" alt="志愿风采 4"></div>
          <div class="hc-slide" data-i="5"><img data-src="carousel/carousel-5.jpg" alt="志愿风采 5"></div>
          <div class="hc-slide" data-i="6"><img data-src="carousel/carousel-6.jpg" alt="志愿风采 6"></div>
          <div class="hc-slide" data-i="7"><img data-src="carousel/carousel-7.jpg" alt="志愿风采 7"></div>
          <div class="hc-slide" data-i="8"><img data-src="carousel/carousel-8.jpg" alt="志愿风采 8"></div>
          <div class="hc-slide" data-i="9"><img data-src="carousel/carousel-9.jpg" alt="志愿风采 9"></div>
          <div class="hc-slide" data-i="10"><img data-src="carousel/carousel-10.jpg" alt="志愿风采 10"></div>
          <div class="hc-slide" data-i="11"><img data-src="carousel/carousel-11.jpg" alt="志愿风采 11"></div>
          <div class="hc-slide" data-i="12"><img data-src="carousel/carousel-12.jpg" alt="志愿风采 12"></div>
        </div>
        <div class="hc-dots" id="hcDots"></div>
        <button class="hc-prev" id="hcPrev" aria-label="上一张">‹</button>
        <button class="hc-next" id="hcNext" aria-label="下一张">›</button>
      </div>
    </div></div>
    <div class="page-block">${blockHead('活动剪影',`<button onclick="goto('activities')">更多活动</button>`)}
      <div class="block-body">${actSnap.length?`<div class="snap-grid">${actSnap.map(a=>a.covers&&a.covers[0]&&a.covers[0].dataUrl?`<div class="snap-item" onclick="viewImg('${a.covers[0].dataUrl}')" title="${esc(a.title)}"><img src="${a.covers[0].dataUrl}"><span class="snap-cap">${esc(a.title)}</span></div>`:`<div class="snap-item snap-text" onclick="goto('activities')" title="${esc(a.title)}">${esc(a.title)}</div>`).join('')}</div>`:'<div class="empty-tip">暂无活动剪影，请在活动中心发布活动并上传封面</div>'}</div>
    </div>
    <div class="page-block">${blockHead('新闻·通报',`<button onclick="goto('news')">更多</button>`)}<div class="block-body" id="dashNews"></div></div>
    <div class="row-3 mb-16">
      <div class="page-block">${blockHead('各专业部服务时长',`<button onclick="goto('reports')">报表</button>`)}<div class="chart-box"><canvas id="chDept"></canvas></div></div>
      <div class="page-block">${blockHead('政治面貌分布','')}<div class="chart-box"><canvas id="chPol"></canvas></div></div>
      <div class="page-block">${blockHead('性别 / 年级占比','')}<div class="chart-box"><canvas id="chGen"></canvas></div></div>
    </div>
    <div class="page-block">${blockHead('部门业绩概况','')}<div class="block-body"><div class="perf-row">${perfCards}</div></div></div>
    <div class="page-block">${blockHead('业绩排行榜 · 服务之星 TOP 10',`<button onclick="goto('data')">完整排行</button>`)}<div class="block-body"><div id="chRank" class="trap-rank"></div></div></div>
    <div class="row-2 mb-16">
      <div class="page-block">${blockHead('任务中心',`<button onclick="goto('tasks')">更多</button>`)}<div class="block-body">${recentTasks.length?`<div class="dash-list">${recentTasks.map(t=>`<div class="dash-item" onclick="goto('tasks')"><div class="dash-t">${esc(t.title)}<span class="tag ${t.status==='open'?'ok':'gray'}">${t.status==='open'?'进行中':'已结束'}</span></div><div class="dash-s">${esc(t.publisher)} · ${esc((t.startDT||'').slice(0,16))} · 已报名 ${(t.signups||[]).length} 人</div></div>`).join('')}</div>`:'<div class="empty-tip">暂无任务</div>'}</div></div>
      <div class="page-block">${blockHead('最近服务记录',`<button onclick="goto('service')">更多</button>`)}<div class="block-body">${recentActs.length?`<table class="tbl"><thead><tr><th>日期</th><th>活动</th><th>班级</th><th>姓名</th></tr></thead><tbody>${recentActs.map(a=>`<tr><td>${esc(a.startDT.slice(0,10))}</td><td>${esc(a.activity)}</td><td>${esc(a.cls)}</td><td>${esc(a.name)}</td></tr>`).join('')}</tbody></table>`:'<div class="empty-tip">暂无服务记录</div>'}</div></div>
    </div>
    <div class="page-block">${blockHead('站内通知（未读）',`<button onclick="$('#notifyDrawer').hidden=false;renderNotifyList('unread')">查看全部</button>`)}<div class="block-body" id="dashNotify"></div></div>
    ${logSection}`;
  drawChartDept();drawChartPol();drawChartGen();renderRankTrapezoid();renderDashNews(pinned,recentNews);renderDashNotify();
  initHeroCarousel();
}

/* ============================== 首页轮播图（12 张图一致随机播放） ============================== */
let _hcTimer=null, _hcOrder=[], _hcIdx=0;
function initHeroCarousel(){
  const track=$('#hcTrack'); if(!track) return;
  const slides=track.querySelectorAll('.hc-slide');
  const N=slides.length;
  if(!N) return;
  /* 一致随机：先按固定会话级种子排序，每次启动顺序一致（不闪烁），但同会话内轮转 */
  _hcOrder=Array.from({length:N},(_,i)=>i);
  for(let i=N-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [_hcOrder[i],_hcOrder[j]]=[_hcOrder[j],_hcOrder[i]]; }
  _hcIdx=0;
  /* 生成圆点 */
  const dots=$('#hcDots'); if(dots){
    dots.innerHTML=_hcOrder.map((_,i)=>`<span class="hc-dot ${i===0?'active':''}" data-d="${i}"></span>`).join('');
    dots.querySelectorAll('.hc-dot').forEach(d=>d.onclick=()=>{_hcIdx=parseInt(d.dataset.d);updateSlide();resetTimer();});
  }
  /* 上一张 / 下一张 */
  const prev=$('#hcPrev'), next=$('#hcNext');
  if(prev) prev.onclick=()=>{_hcIdx=(_hcIdx-1+_hcOrder.length)%_hcOrder.length;updateSlide();resetTimer();};
  if(next) next.onclick=()=>{_hcIdx=(_hcIdx+1)%_hcOrder.length;updateSlide();resetTimer();};
  /* 鼠标悬停暂停 */
  const box=$('#heroCarousel');
  if(box){ box.onmouseenter=()=>{if(_hcTimer)clearInterval(_hcTimer);_hcTimer=null;}; box.onmouseleave=()=>resetTimer(); }
  updateSlide();
  resetTimer();
}
function updateSlide(){
  const track=$('#hcTrack'); if(!track) return;
  /* 纯 display 切换：无 transform 无动画，物理不卡 */
  const slides=track.querySelectorAll('.hc-slide');
  slides.forEach((sl,i)=>{ sl.style.display=(i===_hcIdx?'block':'none'); });
  /* 预加载全部图片（首屏后立即加载，保证切换秒出） */
  track.querySelectorAll('img').forEach(img=>{ if(img.dataset.src && !img.src){ img.src=img.dataset.src; } });
  /* 更新圆点 */
  document.querySelectorAll('.hc-dot').forEach((d,i)=>d.classList.toggle('active',i===_hcIdx));
}
function resetTimer(){
  if(_hcTimer) clearInterval(_hcTimer);
  _hcTimer=setInterval(()=>{_hcIdx=(_hcIdx+1)%_hcOrder.length; updateSlide();}, 2500);
}

function renderRankTrapezoid(){
  const el=$('#chRank');if(!el)return;
  const map={};
  DB.services.forEach(s=>{map[s.name]=(map[s.name]||0)+durationHours(s.startDT,s.endDT)});
  const list=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(!list.length){el.innerHTML='<div class="empty-tip">暂无服务记录</div>';return}
  const max=list[0][1]||1;
  el.innerHTML=list.map(([n,h],i)=>{const w=Math.max(6,(h/max*100).toFixed(1));const c=REDS[Math.min(REDS.length-1,i)];return`<div class="trap-row"><span class="trap-no" style="color:${c}">${i+1}</span><span class="trap-name">${esc(n)}</span><span class="trap-bar" style="width:${w}%;background:${c};"></span><span class="trap-val">${h.toFixed(1)} h</span></div>`}).join('');
}

var REDS=['#f5c2c6','#ef9aa0','#e06a72','#d13a44','#c8161d','#a30e16','#8f0a11','#5f0609'];
function drawChartDept(){const el=$('#chDept');if(!el)return;const map={};DB.services.forEach(s=>{const h=durationHours(s.startDT,s.endDT);map[s.dept]=(map[s.dept]||0)+h});const labels=Object.keys(map),data=labels.map(l=>+(map[l]||0).toFixed(1));new Chart(el,{type:'bar',data:{labels,datasets:[{label:'服务时长(h)',data,backgroundColor:'#c8161d',borderRadius:6,maxBarThickness:42}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}},x:{grid:{display:false},ticks:{font:chartFont()}}}}})}
function drawChartPol(){const el=$('#chPol');if(!el)return;const map={};DB.users.forEach(u=>{if(['member','minister','vice','president'].includes(u.role))map[u.politics||'未填']=(map[u.politics||'未填']||0)+1});const labels=Object.keys(map),data=labels.map(l=>map[l]);new Chart(el,{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:REDS,borderWidth:2,borderColor:'#fff'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{font:chartFont(),usePointStyle:true,pointStyle:'circle',boxWidth:7,color:'#5a5a5a'}}}}})}
function drawChartGen(){const el=$('#chGen');if(!el)return;const ml=['一年级','二年级','三年级'],md=[0,0,0],fd=[0,0,0];DB.users.forEach(u=>{if(u.role==='dev')return;const i=/24/.test(u.cls)?0:1;if(u.gender==='男')md[i]++;else fd[i]++});new Chart(el,{type:'bar',data:{labels:ml,datasets:[{label:'男',data:md,backgroundColor:'#c8161d',borderRadius:4,maxBarThickness:34},{label:'女',data:fd,backgroundColor:'#f0b7ba',borderRadius:4,maxBarThickness:34}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{font:chartFont(),usePointStyle:true,pointStyle:'circle',boxWidth:7,color:'#5a5a5a'}}},scales:{x:{stacked:true,grid:{display:false},ticks:{font:chartFont()}},y:{stacked:true,grid:{color:'#f0f2f5'},ticks:{font:chartFont()}}}}})}
function renderDashHeat(){const target=$('#dashHeat');if(!target)return;const days=30,td=new Date(),counts={};for(let i=days-1;i>=0;i--){const d=new Date(td);d.setDate(td.getDate()-i);counts[fmtDate(d)]=0}DB.services.forEach(s=>{const k=s.startDT.slice(0,10);if(counts[k]!=null)counts[k]++});const max=Math.max(1,...Object.values(counts));target.innerHTML=`<div class="heat-grid" style="grid-template-columns:repeat(15,1fr);">${Object.entries(counts).map(([k,v])=>{const p=v/max;const color=v===0?'#f2f3f5':`rgba(200,22,29,${0.15+0.75*p})`;return`<span class="day" style="background:${color};" title="${k} · ${v} 人次"><span class="tip">${k} · ${v} 人次</span></span>`}).join('')}</div><div class="heat-legend" style="justify-content:flex-end;">少 <span class="heat-cell" style="background:rgba(200,22,29,.15);"></span><span class="heat-cell" style="background:rgba(200,22,29,.5);"></span><span class="heat-cell" style="background:rgba(200,22,29,.9);"></span> 多</div>`}
function renderDashNews(pinned,recent){const t=$('#dashNews');if(!t)return;t.innerHTML=`${pinned.map(n=>`<div class="news-pinned"><span class="label">置 顶</span><h2>${esc(n.title)}</h2><div class="meta">${esc(n.publisher)} · ${esc(fmtDateTime(n.publishedAt))} · 阅读 ${n.reads||0}</div></div>`).join('')}<div class="news-grid">${recent.map(n=>`<div class="news-item"><div><span class="date">${esc((n.publishedAt||'').slice(0,10))}</span><span class="ti" onclick="openNews('${n.id}')">${esc(n.title)}</span><span class="role-tag ${n.type==='通报'?'super':'member'}" style="float:right;">${esc(n.type)}</span></div><div class="desc">${esc((n.content||'').slice(0,80))}${(n.content||'').length>80?'…':''}</div></div>`).join('')}</div>`}
function renderDashNotify(){const t=$('#dashNotify');if(!t)return;const list=DB.notifies.filter(n=>n.unread===true&&canSeeNotify(n)).slice(0,4);if(!list.length){t.innerHTML='<div class="empty-tip">暂无未读通知</div>';return}const routeMap={audit:'audit',act:'activities',task:'tasks',news:'news',sys:'dashboard'};t.innerHTML=list.map(n=>{const r=routeMap[n.kind]||'dashboard';return`<div class="notify-item unread" onclick="goNotify('${n.id}','${r}')"><div class="ti">${esc(n.title)}<time>${esc(fmtDateTime(n.time))}</time></div><div class="ct">${esc(n.content)}</div></div>`}).join('')}

/* ============================== 档案管理 ============================== */
let _filesPage=1;
/* ============================== 档案中心（按部门分组，各部门独立模板） ============================== */
/* 模板对齐《基础信息表.pdf》：青年志愿者/礼仪队/广播站/负责人/副总支 五类，差异字段见 extra */
const FILE_TEMPLATES={
  /* 5 大标准模板（差异化每部门附加字段，避免「模板统一」观感） */
  '青年志愿者协会':{t:'青年志愿者个人信息表',extra:[['vexp','志愿服务经历','t']]},
  '礼仪队':{t:'礼仪队个人信息表',extra:[['vexp','礼仪服务经历','t']]},
  '广播站':{t:'广播站个人信息表',extra:[['langQuality','是否有语言功底','s',['是','否']],['langClarity','普通话讲话是否清晰','s',['是','否']]]},
  '团副总支':{t:'副总支个人信息表',extra:[['acceptMgmt','是否接受工作管理','s',['是','否']],['vexp','团副总支工作经历','t']]},
  '团总支':{t:'负责人个人信息表',extra:[['acceptMgmt','是否接受工作管理','s',['是','否']],['vexp','团总支管理经历','t'],['mgrDuty','分管工作与职责','t']]},
  '学生会':{t:'负责人个人信息表',extra:[['acceptMgmt','是否接受工作管理','s',['是','否']],['vexp','学生工作经历','t'],['mgrDuty','分管工作与职责','t']]},
  '团委办公室':{t:'团委办公室成员个人信息表',extra:[['mgrDuty','分管工作与职责','t'],['vexp','校务工作经历','t']]},
  '专业团支部':{t:'专业团支部个人信息表',extra:[['acceptMgmt','是否接受工作管理','s',['是','否']],['vexp','支部工作经历','t'],['mgrDuty','支部工作职责','t']]},
  '负责人':{t:'负责人个人信息表',extra:[['acceptMgmt','是否接受工作管理','s',['是','否']],['vexp','管理岗位工作经历','t'],['mgrDuty','分管工作与职责','t']]}
};
/* 按部门动态岗位（每个组织独立职位列表，超级管理员可看全部，其他人看本部门 + 通用「成员」） */
const POSTS_BY_ORG={
  '团委办公室':['校团委负责人','办公室副主任','办公室成员'],
  '青年志愿者协会':['协会会长','协会副会长','部长','副部长','组长','成员'],
  '广播站':['站长','副站长','部长','副部长','成员'],
  '礼仪队':['队长','副队长','部长','副部长','成员'],
  '团副总支':['副总支','委员','成员'],
  '团总支':['支书','副支书','委员','成员'],
  '学生会':['主席','副主席','部长','副部长','成员'],
  '专业团支部':['支部书记','副总支','委员','成员']
};
function fileTemplateOf(org){ return FILE_TEMPLATES[org]||FILE_TEMPLATES['青年志愿者协会']; }
function postsByOrg(org){
  const r=currentUser&&currentUser.role;
  const isSysAdmin=r==='super'||r==='terminal'||r==='dev';
  const my=POSTS_BY_ORG[org]||['成员'];
  return isSysAdmin?my:Array.from(new Set([...my,'成员']));
}
let _curFileOrg=''; /* ''=全部档案（系统最高权限窗口） */
function fileOrgTabs(){
  const role=currentUser&&currentUser.role;
  /* 只有系统最高权限者（超级 / 终端管理员）可看「全部档案」；其余所有人（会长 / 副部长 / 部长 / 部门管理员）只可见本部门档案，防信息泄露 */
  if(isSuper()||isTerminal()) return ['',...(DB.dictionaries.organizations||[]).filter(o=>FILE_TEMPLATES[o])];
  const my=currentUser.org||'青年志愿者协会';
  return [my];
}
function renderFiles(root){
  const tabs=fileOrgTabs();
  if(!tabs.includes(_curFileOrg))_curFileOrg=tabs[0]||'';
  const tpl=fileTemplateOf(_curFileOrg,currentUser.role);
  const isAll=!_curFileOrg;
  root.innerHTML=`
    <div class="notice-strip"><span class="label">档案中心</span><span class="ct">点击部门查看对应模板与成员档案；「全部档案」为系统最高权限窗口，汇总所有部门。</span></div>
    <div class="file-tabs">
      ${tabs.map(o=>`<a class="file-tab ${_curFileOrg===o?'active':''}" data-file-org="${o}">${o||'全部档案'}</a>`).join('')}
    </div>
    <div class="search-bar">
      <div class="field"><div class="l">身份证号 / 姓名</div><input id="fKw" placeholder="搜索"></div>
      <div class="field"><div class="l">年级</div><select id="fGrade"><option value="">全部</option>${(DB.dictionaries.grades||[]).map(g=>`<option>${g}</option>`).join('')}</select></div>
      <div class="field"><div class="l">专业部</div><select id="fDept"><option value="">全部</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></div>
      <div class="field"><div class="l">班级</div><select id="fCls"><option value="">全部</option></select></div>
      <div class="field"><div class="l">状态</div><select id="fStatus"><option value="">全部</option><option>正常在岗</option><option>暂停服务</option><option>退出志愿</option><option>注销</option></select></div>
      <div class="btns"><button onclick="filesSearch()">查 询</button><button class="ghost" onclick="filesReset()">重 置</button></div>
    </div>
    <div class="page-block">${blockHead((isAll?'全部部门':'「'+tpl.t+'」')+' · 成员档案（共 <span id="fCount">0</span> 条）',
      `<button onclick="openUserForm()">录入${_curFileOrg||''}档案</button><button class="ghost" onclick="openBatchImport()">批量导入</button><button class="ghost" onclick="downloadArchiveTpl()">下载模板</button><button onclick="exportFilesList()">导出 Excel</button>${canEdit()?'<button class="warn" onclick="openRemoveUser()">撤销职位</button><button class="warn" onclick="openQuitRegister()">成员退出登记</button>':''}`)}
      <div class="block-body"><div class="tbl-shell scroll-x"><table class="tbl" id="filesTable"></table></div><div class="pager" id="filesPager"></div></div>
    </div>
    <div class="row-2">
      <div class="page-block">${blockHead('部门人数分布',`<button class="ghost" onclick="exportFilesSummary()">导出汇总</button>`)}<div class="block-body">${(DB.dictionaries.organizations||[]).map(o=>{const cnt=DB.users.filter(u=>u.org===o).length;return`<div style="display:flex;justify-content:space-between;padding:8px 12px;"><span>${esc(o)}</span><span class="role-tag super">${cnt} 人</span></div>`}).join('')}</div></div>
      <div class="page-block">${blockHead('档案模板说明','')}<div class="block-body"><div class="tip-line">不同部门使用不同《个人信息表》模板（对齐学校基础信息表）：青年志愿者 / 礼仪队 / 广播站 / 负责人（管理岗）/ 副总支；档案录入时自动套用当前部门模板。</div><p style="font-size:13px;line-height:1.85;color:var(--ink-2);">· 只有系统最高权限者（超级管理员 / 终端管理员）可看「全部档案」；其余所有人（会长 / 副部长 / 部长 / 部门管理员）只可见自己部门档案，防止信息泄露。<br>· 详情页可查看完整志愿服务史、导出 PDF 纸质档案。</p></div></div>
    </div>`;
  $$('.file-tab').forEach(a=>a.onclick=()=>{_curFileOrg=a.dataset.fileOrg;renderFiles($('#viewRoot'))});
  filesSearch();
  $('#fDept').onchange=()=>{const list=(DB.dictionaries.classes[$('#fDept').value]||[]);$('#fCls').innerHTML='<option value="">全部</option>'+list.map(c=>`<option>${c}</option>`).join('')};
  /* 档案中心也自动同步云端注册（手机端提交的注册，电脑端档案中心/审核中心都能看到） */
  if(window.zySyncRegs){ try{ zySyncRegs(true); }catch(e){} }
}
function filesReset(){$('#fKw').value='';$('#fGrade').value='';$('#fDept').value='';$('#fCls').innerHTML='<option value="">全部</option>';$('#fStatus').value='';filesSearch()}
function filesSearch(){
  const kw=$('#fKw').value.trim().toLowerCase(),dept=$('#fDept').value,cls=$('#fCls').value,st=$('#fStatus').value,grade=$('#fGrade').value;
  let list=DB.users.filter(u=>u.role!=='dev');
  if(_curFileOrg)list=list.filter(u=>u.org===_curFileOrg);
  list=list.filter(u=>!gFilter.grade||u.grade===gFilter.grade);
  if(kw)list=list.filter(u=>(u.name||'').toLowerCase().includes(kw)||(u.idCard||'').toLowerCase().includes(kw));
  if(dept)list=list.filter(u=>u.dept===dept); if(cls)list=list.filter(u=>u.cls===cls); if(st)list=list.filter(u=>(u.status||'正常在岗')===st); if(grade)list=list.filter(u=>u.grade===grade);
  const pageSize=14,total=list.length,pages=Math.max(1,Math.ceil(total/pageSize));
  if(_filesPage>pages)_filesPage=pages;
  const pageList=list.slice((_filesPage-1)*pageSize,_filesPage*pageSize);
  $('#fCount').textContent=total;
  $('#filesTable').innerHTML=`<thead><tr><th style="width:44px">序号</th><th style="width:90px">姓名</th><th style="width:50px">性别</th><th style="width:150px">身份证号</th><th style="width:100px">专业部</th><th style="width:130px">班级</th><th style="width:100px">部门</th><th style="width:90px">职位</th><th style="width:66px">状态</th><th style="width:380px">操作</th></tr></thead><tbody>${pageList.length?pageList.map((u,i)=>{const idx=(i+1)+(_filesPage-1)*pageSize;return`<tr><td class="ctr">${idx}</td><td><b>${esc(u.name)}</b></td><td class="ctr">${esc(u.gender||'-')}</td><td>${esc((u.idCard||'').slice(0,6))}****${esc((u.idCard||'').slice(-4))}</td><td>${esc(u.dept||'-')}</td><td>${esc(u.cls||'-')}</td><td>${esc(u.org||'-')}</td><td><span class="role-tag ${roleClass(u.role)}">${esc(roleLabel(u.role))}</span></td><td><span class="tag ${u.pending?'warn':(u.activated?'ok':'gray')}">${u.pending?'待审':(u.status==='注销'?'注销':'在岗')}</span></td><td class="ops-cell"><div class="ops-col"><button onclick="viewFile('${u.id}')">详情</button><button onclick="exportCertPDF('${u.id}')">导出</button><button onclick="viewPaper('${u.id}')">档案</button>${canEdit()?`<button class="warn" onclick="openUserForm('${u.id}')">编辑</button>${u.id!==currentUser.id?`<button class="ok" onclick="appointUser('${u.id}')">任命</button>`:''}${canEdit()?`<button class="ok" onclick="viewSecret('${u.id}')">密钥</button>`:''}${u.id!==currentUser.id?`<button class="ok" onclick="graduateUser('${u.id}')">毕业</button>`:''}`:''}${u.id!==currentUser.id?`<button class="warn" onclick="cancelUser('${u.id}')">注销</button>`:''}</div></td></tr>`}).join(''):'<tr><td colspan="10" class="empty">—— 暂无数据 ——</td></tr>'}</tbody>`;
  $('#filesPager').innerHTML=`<button onclick="filesPage(${_filesPage-1})" ${_filesPage<=1?'disabled':''}>< 上一页</button><span class="info">第 ${_filesPage} / ${pages} 页</span><button onclick="filesPage(${_filesPage+1})" ${_filesPage>=pages?'disabled':''}>下一页 ></button>`;
}
function filesPage(p){_filesPage=p;filesSearch()}

window.viewAvatar=(id)=>{const u=DB.users.find(x=>x.id===id);if(!u||!u.avatar)return;$('#ivImg').src=u.avatar;$('#imgViewer').hidden=false};
window.viewFile=(id)=>{const u=DB.users.find(x=>x.id===id);if(!u)return;const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard);openModal(viewFileModal(u,sv))};
function viewFileModal(u,sv){
  const total=sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1);
  const tplX=fileTemplateOf(u.org);
  const vexpL=(tplX.extra.find(x=>x[0]==='vexp')||[])[1]||'服务经历';
  const extraRows=[[u.langQuality?['是否有语言功底',u.langQuality]:null],[u.langClarity?['普通话讲话是否清晰',u.langClarity]:null],[u.acceptMgmt?['是否接受工作管理',u.acceptMgmt]:null],[u.vexp?[vexpL,u.vexp]:null]].flat().filter(Boolean);
  return`<div class="modal wide"><div class="modal-title"><span class="bar"></span>档案详情 · ${esc(u.name)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="archive-paper">
    <h2>${esc(tplX.t||(u.org||'志愿者')+'个人信息表')}</h2>
    <div class="photo">${u.avatar?`<img src="${u.avatar}">`:'二寸<br>证件照'}</div>
    <div class="row">${[['姓名',u.name],['性别',u.gender],['出生年月',u.birth],['民族',u.nation],['籍贯',u.native],['政治面貌',u.politics],['宗教信仰',u.religion],['专业部',u.dept],['班级',u.cls],['职位',u.position],['所在部门',u.org],['邮箱',u.email],['联系电话',u.phone],['身份证号',u.idCard],['所在学校',u.school||DB.school],['居住地址',u.addr],['是否住校',u.live],['教育程度',u.edu]].concat(extraRows).map(([l,v])=>`<div class="it"><div class="l">${esc(l)}</div><div class="v">${esc(v||'-')}</div></div>`).join('')}</div>
    <div class="block-title">志愿服务经历（累计 ${total} 小时 · ${sv.length} 次）</div>
    ${(u.paperFiles&&u.paperFiles.length)?`<div class="block-title">纸质档案（${u.paperFiles.length} 份）</div><div class="paper-mini">${u.paperFiles.map(f=>f.dataUrl&&f.type&&f.type.indexOf('image/')===0?`<img src="${f.dataUrl}" onclick="viewImg('${f.dataUrl}')" title="${esc(f.name)}">`:`<a href="${f.dataUrl}" download="${esc(f.name)}">${esc(f.name)}</a>`).join('')}</div>`:''}
    ${sv.length?`<table><thead><tr><th>序号</th><th>服务日期</th><th>活动</th><th>地点</th><th>时长(h)</th><th>负责人</th></tr></thead><tbody>${sv.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.startDT.slice(0,10))}</td><td>${esc(s.activity)}</td><td>${esc(s.location)}</td><td>${durationHours(s.startDT,s.endDT)}</td><td>${esc(s.serviceBy)}</td></tr>`).join('')}</tbody></table>`:'<p class="text">—— 暂无志愿服务记录 ——</p>'}
    <div class="sign-row"><div class="sign-it">申请人签字：${esc(u.name)}<br>日期：${esc((u.createdAt||now()).slice(0,10))}</div><div class="sign-it">审核人签字：<br>日期：</div></div>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button>${u.addr?`<button class="ghost" onclick="openMap(this.dataset.a)" data-a="${esc(u.addr)}">地图导航</button>`:''}<button class="primary" onclick="exportCertPDF('${u.id}')">导出 PDF</button></div></div>`;
}

/* 档案模板附加字段渲染 / 收集（按部门模板） */
function renderUfExtra(org){
  const box=$('#ufExtra');if(!box)return;
  const tpl=fileTemplateOf(org);
  const u=window._ufCur||null;
  if(!tpl.extra.length){box.innerHTML='';return}
  box.innerHTML='<div class="full" style="grid-column:1/-1;border-top:1px dashed #e0e0e0;padding-top:10px;margin-top:4px;font-size:13px;color:var(--red);font-weight:600;">『'+tpl.t+'』模板附加项</div>'+tpl.extra.map(([k,l,type,opts])=>{
    const cur=(u&&u[k])!=null?u[k]:(type==='s'?'':(u?u[k]||'':''));
    if(type==='s')return`<label>${l}<select id="uf_${k}">${opts.map(o=>`<option ${cur===o?'selected':''}>${o}</option>`).join('')}</select></label>`;
    return`<label class="full">${l}<textarea id="uf_${k}">${esc(cur||'')}</textarea></label>`;
  }).join('');
}
function collectUfExtra(){
  const o={};
  ['vexp','langQuality','langClarity','acceptMgmt','mgrDuty'].forEach(k=>{const el=$('#uf_'+k);if(el)o[k]=el.value.trim()});
  return o;
}
window.openUserForm=function(existing){
  const u=existing?DB.users.find(x=>x.id===existing):null,isEdit=!!u;
  window._ufCur=u;
  const initOrg=u?u.org:(_curFileOrg||'青年志愿者协会');
  const tpl0=fileTemplateOf(initOrg);
  const m=openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>${isEdit?'编辑':'录入'}「${tpl0.t}」<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid cols-2">
    <label>姓名<i>*</i><input id="ufName" value="${esc(u?.name||'')}"></label>
    <label>身份证号<i>*</i><input id="ufIdCard" maxlength="18" value="${esc(u?.idCard||'')}"></label>
    <label>角色<select id="ufRole">${(DB.dictionaries.role||[]).filter(x=>x.val!=='dev').map(r=>`<option value="${r.val}" ${u?.role===r.val?'selected':''}>${r.label}</option>`).join('')}</select></label>
    <label>性别<select id="ufGender"><option ${u?.gender==='男'?'selected':''}>男</option><option ${u?.gender==='女'?'selected':''}>女</option></select></label>
    <label>出生年月<input id="ufBirth" type="date" value="${esc(u?.birth||'')}"></label>
    <label>民族<select id="ufNation">${(DB.dictionaries.nation||[]).map(n=>`<option ${u?.nation===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>政治面貌<select id="ufPolitics">${(DB.dictionaries.politics||[]).map(n=>`<option ${u?.politics===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>宗教信仰<select id="ufReligion">${(DB.dictionaries.religion||[]).map(n=>`<option ${u?.religion===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>专业部<select id="ufDept"><option value="">-</option>${(DB.dictionaries.departments||[]).map(d=>`<option ${u?.dept===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>班级<input id="ufCls" value="${esc(u?.cls||'')}" placeholder="如：2024级计算机5班（格式：XXXX级专业XX班）"></label>
    <label>所在部门<i>*</i><select id="ufOrg">${(DB.dictionaries.organizations||[]).map(d=>`<option ${(u?.org||initOrg)===d?'selected':''}>${d}</option>`).join('')}</select></label>
    <label>职位 / 类型<i>*</i><select id="ufTitle" data-datalist="ufTitleList"></select><datalist id="ufTitleList"></datalist></label>
    <label>邮箱<input id="ufEmail" value="${esc(u?.email||'')}"></label>
    <label>联系电话<input id="ufPhone" value="${esc(u?.phone||'')}"></label>
    <label>QQ（选填）<input id="ufQQ" value="${esc(u?.qq||'')}"></label>
    <label>微信号（选填）<input id="ufWechat" value="${esc(u?.wechat||'')}"></label>
    <label>籍贯<input id="ufNative" value="${esc(u?.native||'')}"></label>
    <label>居住地址<input id="ufAddr" value="${esc(u?.addr||'')}"></label>
    <label>是否住校<select id="ufLive">${(DB.dictionaries.live||[]).map(n=>`<option ${u?.live===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>教育程度<select id="ufEdu">${(DB.dictionaries.education||[]).map(n=>`<option ${u?.edu===n?'selected':''}>${n}</option>`).join('')}</select></label>
    <label>登录密码<input id="ufPwd" type="text" placeholder="${isEdit?'留空不修改':'初始密码（≥6位）'}"></label>
    <label>状态<select id="ufStatus"><option>正常在岗</option><option>暂停服务</option><option>退出志愿</option><option>注销</option></select></label>
    <label class="full">证件照（白底二寸）<input id="ufPhoto" type="file" accept="image/*"><div id="ufPreview"></div></label>
    <label class="full">个人经历<textarea id="ufExp">${esc(u?.exp||'')}</textarea></label>
    <div class="full" id="ufExtra"></div>
    <label class="full">兴趣爱好 / 特长<textarea id="ufHobby">${esc(u?.hobby||'')}</textarea></label>
  </div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="ufSave">${isEdit?'保存修改':'提交录入'}</button></div></div>`);
  $('#ufStatus').value=u?.status||'正常在岗';
  /* 部门 ↔ 职位 联动：切换部门时刷新职位 datalist；编辑时按所在部门预填当前职位 */
  const initTitle=u?.title||'';
  const refTitle=()=>{
    const list=postsByOrg($('#ufOrg').value||'青年志愿者协会');
    const dat=$('#ufTitleList');if(dat)dat.innerHTML=list.map(p=>`<option value="${p}">`).join('');
    const tEl=$('#ufTitle');
    if(tEl){
      const cur=u?.title||tEl.value||'';
      const inList=list.includes(cur);
      const opts=list.map(p=>`<option value="${p}" ${p===cur?'selected':''}>${p}</option>`).join('')+(cur&&!inList?`<option value="${cur}" selected>${cur}（自定义）</option>`:'');
      tEl.innerHTML=opts;
    }
  };
  refTitle();
  renderUfExtra(initOrg);
  $('#ufOrg').onchange=()=>{renderUfExtra($('#ufOrg').value);refTitle();/* 同时刷新 modal 标题 */const t=fileTemplateOf($('#ufOrg').value);const tEl=m&&m.querySelector&&m.querySelector('.modal-title');if(tEl)tEl.innerHTML=`<span class="bar"></span>${isEdit?'编辑':'录入'}「${t.t}」<span class="bar"></span><button class="x" data-close-modal>×</button>`;window._ufCur=u};
  if(u&&u.avatar)$('#ufPreview').innerHTML=`<img src="${u.avatar}" style="width:100px;height:130px;object-fit:cover;border-radius:2px;margin-top:6px;">`;
  $('#ufSave').onclick=()=>{
    const idCard=$('#ufIdCard').value.trim(),name=$('#ufName').value.trim();
    if(!isIDCard(idCard))return toast('身份证号格式不正确','err');
    if(!name)return toast('请填写姓名','err');
    if(!isEdit&&!$('#ufPwd').value)return toast('请为新档案设置登录密码','err');
    const others=DB.users.filter(x=>x.idCard===idCard&&(!u||x.id!==u.id));
    if(others.length)return toast('该身份证号已被占用','err');
    const photo=$('#ufPhoto').files[0];
    const finish=(avatar)=>{
      if(isEdit){
        const t=DB.users.find(x=>x.id===u.id);
        Object.assign(t,{name,role:$('#ufRole').value,gender:$('#ufGender').value,birth:$('#ufBirth').value,nation:$('#ufNation').value,politics:$('#ufPolitics').value,religion:$('#ufReligion').value,dept:$('#ufDept').value,cls:$('#ufCls').value,org:$('#ufOrg').value,title:$('#ufTitle').value,email:$('#ufEmail').value,phone:$('#ufPhone').value,qq:$('#ufQQ').value,wechat:$('#ufWechat').value,native:$('#ufNative').value,addr:$('#ufAddr').value,live:$('#ufLive').value,edu:$('#ufEdu').value,status:$('#ufStatus').value,exp:$('#ufExp').value,hobby:$('#ufHobby').value},collectUfExtra());
        if(avatar)t.avatar=avatar;
        if($('#ufPwd').value)t.pwd=$('#ufPwd').value;
        pushLog('修改档案',`修改 ${t.name}`);
      }else{
        const next=(DB.nextIds.user=(DB.nextIds.user||0)+1);
        DB.users.push({id:'u-'+next,idCard,name,pwd:$('#ufPwd').value,role:$('#ufRole').value,org:$('#ufOrg').value,gender:$('#ufGender').value,birth:$('#ufBirth').value,nation:$('#ufNation').value,politics:$('#ufPolitics').value,religion:$('#ufReligion').value,dept:$('#ufDept').value,cls:$('#ufCls').value,title:$('#ufTitle').value,email:$('#ufEmail').value,phone:$('#ufPhone').value,qq:$('#ufQQ').value,wechat:$('#ufWechat').value,native:$('#ufNative').value,addr:$('#ufAddr').value,live:$('#ufLive').value,edu:$('#ufEdu').value,status:$('#ufStatus').value,avatar,exp:$('#ufExp').value,hobby:$('#ufHobby').value,position:'志愿者',activated:true,pending:false,createdAt:now()},collectUfExtra());
        pushLog('录入档案',`录入 ${name}`);
      }
      saveDB();closeModal();toast(isEdit?'已保存':'已录入','ok');
      if(currentRoute()==='files')filesSearch();
    };
    if(photo){const r=new FileReader();r.onload=()=>finish(r.result);r.readAsDataURL(photo)}else finish(u?u.avatar:'');
  };
};

window.removeUser=(id)=>{const u=DB.users.find(x=>x.id===id);confirmDialog(`确认撤销 <b>${esc(u.name)}</b> 的职位？`,()=>{u.role='member';u.activated=false;u.status='退出志愿';saveDB();filesSearch();toast('已撤销','ok')},'撤销职位')};
window.graduateUser=(id)=>{const u=DB.users.find(x=>x.id===id);if(!u)return;confirmDialog(`确认将 <b>${esc(u.name)}</b> 毕业升级？系统会自动建立对应新年级组织。`,()=>{const m=(u.cls||'').match(/(\d{2})级/);if(!m)return toast('该档案未填写班级年级，无法毕业','err');const ng=String(parseInt(m[1])+1).padStart(2,'0')+'级';if(!(DB.dictionaries.grades||[]).includes(ng))(DB.dictionaries.grades||(DB.dictionaries.grades=[])).push(ng);u.cls=u.cls.replace(m[0],ng);u.grade=ng;u.status='正常在岗';const cl=DB.dictionaries.classes&&DB.dictionaries.classes[u.dept];if(cl&&!cl.includes(u.cls))cl.push(u.cls);saveDB();pushLog('毕业',`${u.name} 毕业升级至 ${ng}`);filesSearch();toast('已毕业升级至 '+ng,'ok')},'毕业升级')};
window.cancelUser=(id)=>{const u=DB.users.find(x=>x.id===id);if(!u)return;if(!canEdit())return toast('仅管理员可注销成员档案','err');confirmDialog(`确认注销 <b>${esc(u.name)}</b> 的志愿者身份？<br><span class="f12 c-3">注销后该成员不可登录，档案标记为"注销"并保留备查。</span>`,()=>{u.status='注销';u.activated=false;u.pending=false;saveDB();pushLog('注销',`注销 ${u.name}`);filesSearch();toast('已注销','ok')},'注销档案')};
window.openQuitRegister=function(){
  if(!canEdit())return toast('仅管理员可操作','err');
  const candidates=DB.users.filter(u=>u.role!=='dev'&&u.id!==currentUser.id&&(u.status||'正常在岗')!=='注销').sort((a,b)=>String(a.dept||'').localeCompare(String(b.dept||'')));
  if(!candidates.length)return toast('暂无可登记退出的成员','err');
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>成员退出登记（批量注销）<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p class="warn">成员不干了（毕业、退出、违纪等），管理员在此勾选要注销的成员 → 提交后立即注销账号、保留档案备查。</p><div class="form-grid cols-2 mb-12"><div class="field"><div class="l">专业部</div><select id="qrDept"><option value="">全部</option>${(DB.dictionaries.departments||[]).map(d=>`<option>${d}</option>`).join('')}</select></div><div class="field"><div class="l">部门 / 组织</div><select id="qrOrg"><option value="">全部</option>${(DB.dictionaries.organizations||[]).map(d=>`<option>${d}</option>`).join('')}</select></div></div><div class="tbl-shell scroll-x" style="max-height:400px;overflow-y:auto;"><table class="tbl"><thead><tr><th style="width:40px"><input type="checkbox" id="qrAll"></th><th>姓名</th><th>专业部/班级</th><th>部门</th><th>职位</th><th>状态</th></tr></thead><tbody>${candidates.map(u=>`<tr data-dept="${esc(u.dept||'')}" data-org="${esc(u.org||'')}"><td class="ctr"><input type="checkbox" class="qr-cb" value="${u.id}"></td><td><b>${esc(u.name)}</b></td><td>${esc(u.dept||'-')} / ${esc(u.cls||'-')}</td><td>${esc(u.org||'-')}</td><td>${esc(roleLabel(u.role))}</td><td><span class="tag">${esc(u.status||'正常在岗')}</span></td></tr>`).join('')}</tbody></table></div></div><div class="modal-foot"><span class="f12 c-3" id="qrCnt" style="margin-right:auto;">已选 0 人</span><button class="ghost" data-close-modal>取消</button><button class="warn" id="qrSubmit">确认注销所选</button></div></div>`);
  const filter=()=>{const d=$('#qrDept').value,o=$('#qrOrg').value;document.querySelectorAll('.qr-cb').forEach(cb=>{const tr=cb.closest('tr');tr.style.display=(d&&tr.dataset.dept!==d)||(o&&tr.dataset.org!==o)?'none':'';});};
  $('#qrDept').onchange=filter;$('#qrOrg').onchange=filter;
  const updCnt=()=>{const n=document.querySelectorAll('.qr-cb:checked').length;$('#qrCnt').textContent='已选 '+n+' 人';};
  $('#qrAll').onchange=(e)=>{const on=e.target.checked;document.querySelectorAll('.qr-cb').forEach(cb=>{cb.checked=on;});updCnt();};
  document.querySelectorAll('.qr-cb').forEach(cb=>cb.onchange=updCnt);
  $('#qrSubmit').onclick=()=>{const ids=[...document.querySelectorAll('.qr-cb:checked')].map(cb=>cb.value);if(!ids.length)return toast('请先勾选要注销的成员','err');confirmDialog(`确认注销 <b>${ids.length}</b> 位成员？<br><span class="f12 c-3">注销后不可登录，档案保留备查。</span>`,()=>{let n=0;ids.forEach(id=>{const u=DB.users.find(x=>x.id===id);if(u){u.status='注销';u.activated=false;u.pending=false;n++;pushLog('注销',`批量注销 ${u.name}`);}});saveDB();closeModal();filesSearch();toast('已注销 '+n+' 人','ok')},'批量注销');};
};
window.viewSecret=function(id){
  if(!canEdit())return toast('仅管理员可查看成员密钥','err');
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const sec=u.totpSecret||(u.totpSecret=genSecret());
  if(!u.totpSecret){u.totpSecret=sec;saveDB();}
  const m=openModal(`<div class="modal" style="width:540px;"><div class="modal-title"><span class="bar"></span>成员密钥 · ${esc(u.name)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p class="warn">将密钥告知成员后，成员在登录页「忘记密码」→ 输入身份证号 + 动态口令（每 5 分钟更新）即可重置密码。</p><div class="kv mt-12"><div style="grid-column:1/-1"><div class="l">密钥（32 位十六进制串，请告知成员妥善保管）</div><div class="v" style="font-family:Consolas,Monaco,monospace;word-break:break-all;letter-spacing:.05em;background:#fbecee;padding:8px 10px;color:var(--red);">${esc(sec)}</div></div><div style="grid-column:1/-1"><div class="l">当前动态口令（5 分钟更新）</div><div class="v" style="font-size:26px;font-weight:700;color:var(--red);letter-spacing:.16em;padding:6px 0;" id="vsCode">${computeTOTP(sec)}</div></div><div><div class="l">姓名</div><div class="v">${esc(u.name)}</div></div><div><div class="l">身份证号</div><div class="v">${esc(u.idCard)}</div></div></div><textarea id="vsSec" style="position:absolute;left:-9999px;top:-9999px;">${esc(sec)}</textarea><div class="mt-16" style="display:flex;gap:8px;"><button class="primary" onclick="var t=document.getElementById('vsSec');t.select();try{document.execCommand('copy');toast('已复制密钥','ok');}catch(_){toast('请手动复制','err');}">复制密钥</button><button class="ghost" data-close-modal>关闭</button></div></div></div>`);
  if(m){clearInterval(window._vsT);window._vsT=setInterval(()=>{const e=m.querySelector('#vsCode');if(e)e.textContent=computeTOTP(sec);},1000);}
};
window.uploadPaper=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  if(!canEdit())return toast('仅管理员可上传纸质档案','err');
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>上传纸质档案 · ${esc(u.name)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p class="warn">纸质档案仅管理员与上级可上传（扫描件 / 照片），普通成员不可上传。</p><label>选择纸质档案文件（可多选，支持图片 / PDF / 压缩包）<input id="pfFile" type="file" accept="image/*,.pdf,.zip,.rar" multiple></label><div id="pfPreview" class="mt-12"></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="pfSave">上传保存</button></div></div>`);
  let files=[];
  $('#pfFile').onchange=(ev)=>{const fs=Array.from(ev.target.files);Promise.all(fs.map(f=>new Promise(r=>{const rd=new FileReader();rd.onload=()=>r({name:f.name,dataUrl:rd.result,type:f.type});rd.readAsDataURL(f)}))).then(arr=>{files=arr;$('#pfPreview').innerHTML='<div class="tip-line">已选择 '+arr.length+' 个文件</div>'})};
  $('#pfSave').onclick=()=>{
    if(!files.length)return toast('请先选择文件','err');
    u.paperFiles=u.paperFiles||[];
    files.forEach(f=>u.paperFiles.push(Object.assign(f,{time:now(),uploader:currentUser.name})));
    saveDB();pushLog('上传纸质档案',`${currentUser.name} 上传 ${u.name} 的纸质档案 ${files.length} 份`);
    closeModal();viewPaper(id);toast('已上传 '+files.length+' 份','ok');
  };
};
window.viewPaper=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const list=u.paperFiles||[];
  openModal(`<div class="modal wide"><div class="modal-title"><span class="bar"></span>纸质档案 · ${esc(u.name)}（${list.length} 份）<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body">
    ${canEdit()?'<div class="tip-line">点击「上传纸质档案」直接选择扫描件/照片上传，无需下载模板。</div>':'<div class="tip-line">纸质档案由管理员统一上传保管，成员不可上传。</div>'}
    ${list.length?`<div class="paper-grid">${list.map(f=>f.dataUrl&&f.type&&f.type.indexOf('image/')===0?`<div class="paper-item" onclick="viewImg('${f.dataUrl}')" title="${esc(f.name)}"><img src="${f.dataUrl}"><span class="paper-name">${esc(f.name)}</span><span class="paper-meta">${esc(f.uploader||'-')} · ${esc((f.time||'').slice(0,10))}</span></div>`:`<div class="paper-file"><a href="${f.dataUrl}" download="${esc(f.name)}">${esc(f.name)}</a><span class="paper-meta">${esc(f.uploader||'-')} · ${esc((f.time||'').slice(0,10))}</span></div>`).join('')}</div>`:'<div class="empty-tip">暂无纸质档案</div>'}
  </div><div class="modal-foot">${canEdit()?`<button class="primary" onclick="uploadPaper('${u.id}')">上传纸质档案</button>`:''}<button class="ghost" data-close-modal>关闭</button></div></div>`);
};
window.appointUser=(id)=>{const u=DB.users.find(x=>x.id===id);openModal(`<div class="modal" style="width:480px;"><div class="modal-title"><span class="bar"></span>任命 · ${esc(u.name)}<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><div class="form-grid"><label>角色<select id="apRole">${(DB.dictionaries.role||[]).filter(x=>x.val!=='dev').map(r=>`<option value="${r.val}">${r.label}</option>`).join('')}</select></label><label>职位名称<input id="apTitle" value="${esc(u.title||'')}"></label></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="apSave">确认任命</button></div></div>`);$('#apSave').onclick=()=>{u.role=$('#apRole').value;u.title=$('#apTitle').value;u.position=u.title;u.activated=true;saveDB();closeModal();filesSearch();toast('任命成功','ok')}};
window.openRemoveUser=function(){const candidates=DB.users.filter(u=>u.role!=='dev'&&u.role!=='member'&&u.id!==currentUser.id);if(!candidates.length)return toast('暂无可撤销的管理员','err');openModal(`<div class="modal" style="width:520px;"><div class="modal-title"><span class="bar"></span>撤销职位<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p class="warn">撤销后降为「志愿者」且停用账号。</p><table class="tbl"><thead><tr><th>姓名</th><th>职位</th><th>专业部</th><th></th></tr></thead><tbody>${candidates.map(u=>`<tr><td>${esc(u.name)}</td><td><span class="role-tag ${roleClass(u.role)}">${esc(roleLabel(u.role))}</span></td><td>${esc(u.dept||'-')}</td><td><button class="warn" onclick="removeUser('${u.id}')" style="height:26px;padding:0 10px;background:#fff;color:var(--red);box-shadow:0 0 0 1px var(--red) inset;border-radius:2px;">撤销</button></td></tr>`).join('')}</tbody></table></div><div class="modal-foot"><button class="ghost" data-close-modal>关闭</button></div></div>`)};

window.exportCertPDF=function(id){
  const u=DB.users.find(x=>x.id===id);if(!u)return;
  const org=u.org||'青年志愿者协会';
  const TITLES={'青年志愿者协会':'青年志愿者个人信息表','礼仪队':'礼仪队个人信息表','广播站':'广播站个人信息表','团总支':'负责人个人信息表','团副总支':'副总支个人信息表','学生会':'负责人个人信息表'};
  const isVol=org==='青年志愿者协会';
  const isEtiq=org==='礼仪队';
  const isBroad=org==='广播站';
  const isMgr=!isVol&&!isEtiq&&!isBroad;
  const title=TITLES[org]||(org+'个人信息表');
  const svcTitle=isEtiq?'礼仪服务经历':isBroad?'播音工作经历':isVol?'志愿服务经历':'服务经历';
  const sv=DB.services.filter(s=>s.name===u.name&&s.idCard===u.idCard);
  const P=window.CanvasPDF;P.init();
  const red='#c8161d',ink='#1a1a1a',gray='#5a5a5a';
  // 标题
  P.center(title,P.y,{size:22,bold:true,color:red});P.y+=6;
  P.center('（'+DB.school+'）',P.y,{size:12,color:gray});P.y+=8;
  P.line(56,P.y,P.W-56,P.y,red,1.2);P.y+=12;
  // 证件照
  const px=P.W-56-66;const py=P.y-6;
  P.box(px,py,66,86,'#f7f8fa');P.ctx.strokeStyle='#c0c4cc';P.ctx.lineWidth=.8;P.ctx.strokeRect(px,py,66,86);
  if(u.avatar){try{const img=new Image();img.src=u.avatar;if(img.complete&&img.naturalWidth>0)P.ctx.drawImage(img,px,py,66,86)}catch(e){}}
  else P.text('二寸\n证件照',px+33,py+38,{size:10,color:gray,align:'center'});
  // 头部：单位 / 申请人 / 审核 / 第 届
  const headY=P.y;
  P.text('单位：'+DB.school,56,headY,{size:11,color:ink});
  P.text('申请人：'+u.name,310,headY,{size:11,color:ink});
  P.text('审核人签字：',440,headY,{size:11,color:ink});
  P.text('第　届',P.W-80,headY,{size:11,color:ink});
  P.y+=16;
  // 18 基础字段（两列）
  const fields=[['姓名',u.name],['性别',u.gender],['出生年月',u.birth],['民族',u.nation],['籍贯',u.native],['政治面貌',u.politics],['宗教信仰',u.religion],['专业部',u.dept],['班级',u.cls],['职位',u.position||u.title],['邮箱',u.email],['联系电话',u.phone],['身份证号',u.idCard],['所在学校',u.school||DB.school],['居住地址',u.addr],['是否住校',u.live?`☑${u.live}`:'☐住校 ☐走读'],['所在部门',u.org],['教育程度',u.edu]];
  const colW=Math.floor((P.W-112-90)/2),lbl=66,rowH=24;
  // 右侧 86px 给证件照
  fields.forEach((f,i)=>{const c=i%2,r=Math.floor(i/2),x=56+c*colW,yy=P.y+r*rowH;
    P.ensure(rowH);
    P.box(x,yy-16,lbl,rowH,'#fbecee');
    P.ctx.strokeStyle='#e5e7eb';P.ctx.lineWidth=.5;P.ctx.strokeRect(x,yy-16,colW,rowH);
    P.text(f[0],x+8,yy,{size:10,bold:true,color:gray});
    P.text(P._clip(String(f[1]==null?'-':f[1]),colW-lbl-14,10),x+lbl+8,yy,{size:10,color:ink});
  });
  P.y+=Math.ceil(fields.length/2)*rowH+8;
  // 是否有工作经历
  P.text('是否有工作经历：'+(u.workExp?`☑${u.workExp}`:'☐是 ☐否'),56,P.y,{size:11,color:ink});P.y+=16;
  // 特殊字段：广播站 语言功底 + 普通话
  if(isBroad){
    P.text('是否有语言功底：'+(u.langQuality?`☑${u.langQuality}`:'☐是 ☐否')+'　　普通话讲话是否清晰：'+(u.langClear?`☑${u.langClear}`:'☐是 ☐否'),56,P.y,{size:11,color:ink});P.y+=18;
  }
  // 特殊字段：负责人/副总支 是否接受工作管理
  if(isMgr){
    P.text('是否接受工作管理：'+(u.acceptMgmt?`☑${u.acceptMgmt}`:'☐是 ☐否'),56,P.y,{size:11,color:ink});P.y+=18;
  }
  // 个人经历
  P.text('个人经历：',56,P.y,{size:11,bold:true,color:ink});
  const exp=String(u.exp||'').slice(0,120);
  if(exp){P.text(P._clip(exp,P.W-180,10),170,P.y,{size:10,color:ink});P.y+=16;}
  else{P.text('—',170,P.y,{size:10,color:gray});P.y+=16;}
  // 部门经历小节
  P.text(svcTitle+'（累计 '+sv.reduce((s,x)=>s+durationHours(x.startDT,x.endDT),0).toFixed(1)+' 小时 · '+sv.length+' 次）',56,P.y,{size:14,bold:true,color:red});
  P.y+=4;P.line(56,P.y,P.W-56,P.y,red,.8);P.y+=8;
  if(sv.length){
    P.table(['序号','日期','活动/任务','地点','时长(h)','负责人'],sv.map((s,i)=>[i+1,s.startDT.slice(0,10),s.activity,s.location,durationHours(s.startDT,s.endDT),s.serviceBy||'-']),(svTitleW=sv.length?[44,86,200,150,72,128]:[44,86,200,150,72,128]),{size:9,rowH:23});
    P.y+=10;
  }else{
    P.text('—— 暂无记录 ——',56,P.y,{size:10,color:gray});P.y+=14;
  }
  // 兴趣爱好
  P.text('兴趣爱好 / 特长：',56,P.y,{size:11,bold:true,color:ink});
  const hb=String(u.hobby||'').slice(0,120);
  if(hb){P.text(P._clip(hb,P.W-180,10),170,P.y,{size:10,color:ink});P.y+=18;}
  else{P.text('—',170,P.y,{size:10,color:gray});P.y+=18;}
  P.ensure(30);
  P.text('申请人签字：'+u.name,56,P.y,{size:11,color:ink});P.text('审核人签字：',P.W/2+20,P.y,{size:11,color:ink});P.y+=18;
  P.text('日期：'+(u.createdAt||now()).slice(0,10),56,P.y,{size:11,color:ink});P.text('日期：',P.W/2+20,P.y,{size:11,color:ink});
  P.save((u.name||'')+'_'+(org||'志愿者')+'_档案.pdf');
};

window.downloadArchiveTpl=function(){
  const wb=XLSX.utils.book_new();
  const header=['姓名','身份证号','性别','出生年月','民族','籍贯','政治面貌','宗教信仰','专业部','班级','所在部门','职位','邮箱','联系电话','QQ/微信','所在学校','居住地址','是否住校','教育程度','个人经历','志愿服务经历','兴趣爱好'];
  const row=['示例-小张','513022200703120000','女','2007年3月12日','汉族','四川宣汉','共青团员','无','现代服务部','25级养护4班','青年志愿者协会','志愿者','x@example.com','13800000000','QQ12345','四川省宣汉职业中专学校','四川省达州市宣汉县','住校','中专','在校表现优秀','积极参加志愿服务','阅读、运动'];
  const ws=XLSX.utils.aoa_to_sheet([header,row]);XLSX.utils.book_append_sheet(wb,ws,'档案导入模板');XLSX.writeFile(wb,'志愿者档案导入模板.xlsx');
};
window.openBatchImport=function(){
  openModal(`<div class="modal"><div class="modal-title"><span class="bar"></span>批量导入档案<span class="bar"></span><button class="x" data-close-modal>×</button></div><div class="modal-body"><p class="warn">先「下载模板」填写后上传；身份证+姓名重复自动跳过。</p><div class="form-grid cols-1"><label>选择文件<input id="impFile" type="file" accept=".xlsx,.xls,.csv"></label></div><div id="impPreview" class="mt-12"></div></div><div class="modal-foot"><button class="ghost" data-close-modal>取消</button><button class="primary" id="impSubmit">开始导入</button></div></div>`);
  let rows=[];
  $('#impFile').onchange=(ev)=>{const file=ev.target.files[0];if(!file)return;const rd=new FileReader();rd.onload=(e)=>{try{const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const data=XLSX.utils.sheet_to_json(ws,{header:1});const hd=data[0];const mapKey={'姓名':'name','身份证号':'idCard','性别':'gender','出生年月':'birth','民族':'nation','籍贯':'native','政治面貌':'politics','宗教信仰':'religion','专业部':'dept','班级':'cls','所在部门':'org','职位':'title','邮箱':'email','联系电话':'phone','QQ/微信':'qq','所在学校':'school','居住地址':'addr','是否住校':'live','教育程度':'edu','个人经历':'exp','志愿服务经历':'vexp','兴趣爱好':'hobby'};rows=data.slice(1).filter(r=>r[0]&&r[1]).map(r=>{const o={};hd.forEach((h,i)=>{if(h&&r[i]!=null)o[mapKey[String(h).trim()]||String(h).trim()]=String(r[i]).trim()});return o});$('#impPreview').innerHTML=`<div class="tip-line">识别到 <b>${rows.length}</b> 条</div>`}catch(err){toast('文件解析失败','err')}};rd.readAsArrayBuffer(file)};
  $('#impSubmit').onclick=()=>{if(!rows.length)return toast('请先选择文件','err');let added=0;rows.forEach(r=>{if(!r.idCard||!r.name)return;if(DB.users.some(u=>u.idCard===r.idCard))return;const next=(DB.nextIds.user=(DB.nextIds.user||0)+1);DB.users.push(Object.assign({id:'u-'+next,role:'member',org:'青年志愿者协会',title:'志愿者',nation:'汉族',politics:'群众',religion:'无',school:DB.school,position:'志愿者',pwd:'123456',activated:true,pending:false,status:'正常在岗',createdAt:now()},r));added++});saveDB();closeModal();filesSearch();toast(`成功导入 ${added} 条`,'ok')};
};
window.exportFilesList=function(){
  const rows=DB.users.filter(u=>u.role!=='dev').map(u=>({'姓名':u.name,'性别':u.gender,'专业部':u.dept,'班级':u.cls,'部门':u.org,'职位':u.title,'角色':roleLabel(u.role),'身份证号':u.idCard,'电话':u.phone,'邮箱':u.email,'政治面貌':u.politics,'状态':u.status||'正常在岗'}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'志愿者档案');XLSX.writeFile(wb,`志愿者档案_${today()}.xlsx`);toast('已导出','ok');
};
window.exportFilesSummary=function(){
  const rows=(DB.dictionaries.organizations||[]).map(o=>({'部门':o,'人数':DB.users.filter(u=>u.org===o).length}));
  const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'部门汇总');XLSX.writeFile(wb,`部门人数汇总_${today()}.xlsx`);toast('已导出','ok');
};

/* ============================== Canvas PDF 导出器（中文不乱码，离线可用） ============================== */
window.CanvasPDF={
  doc:null,cv:null,ctx:null,W:794,H:1123,y:64,
  _fonts:'"Microsoft YaHei","微软雅黑","PingFang SC","Helvetica Neue",sans-serif',
  init(){ const {jsPDF}=window.jspdf; this.doc=new jsPDF('p','pt','a4'); this.newPage(); },
  newPage(){ if(this.cv&&this.y>70){ this.doc.addImage(this.cv.toDataURL('image/png'),'PNG',0,0,595.28,841.89); this.doc.addPage(); }
    this.cv=document.createElement('canvas'); this.cv.width=this.W; this.cv.height=this.H; this.ctx=this.cv.getContext('2d');
    this.ctx.fillStyle='#ffffff'; this.ctx.fillRect(0,0,this.W,this.H); this.y=64; },
  f(sz,bold){ this.ctx.font=(bold?'700 ':'400 ')+sz+'px '+this._fonts; },
  text(str,x,y,o){ o=o||{}; this.f(o.size||12,o.bold); this.ctx.fillStyle=o.color||'#1a1a1a'; this.ctx.textAlign=o.align||'left'; this.ctx.fillText(String(str==null?'':str),x,y); },
  center(str,y,o){ o=o||{}; this.f(o.size||12,o.bold); this.ctx.fillStyle=o.color||'#1a1a1a'; this.ctx.textAlign='center'; this.ctx.fillText(String(str==null?'':str),this.W/2,y); },
  line(x1,y1,x2,y2,c,w){ c=c||'#c8161d'; w=w||1; this.ctx.strokeStyle=c; this.ctx.lineWidth=w; this.ctx.beginPath(); this.ctx.moveTo(x1,y1); this.ctx.lineTo(x2,y2); this.ctx.stroke(); },
  box(x,y,w,h,c){ this.ctx.fillStyle=c||'#fbecee'; this.ctx.fillRect(x,y,w,h); },
  ensure(h){ if(this.y+h>this.H-40) this.newPage(); },
  table(head,rows,colW,o){ o=o||{}; const size=o.size||11,rowH=o.rowH||26,headH=30;
    const x0=o.x||56,totalW=colW.reduce((a,b)=>a+b,0);
    if(this.y+headH>this.H-40) this.newPage();
    this.box(x0,this.y,totalW,headH,'#fbecee');
    this.f(size,true); this.ctx.fillStyle='#c8161d';
    let cx=x0; head.forEach(h=>{ this.ctx.textAlign='left'; this.ctx.fillText(String(h),cx+8,this.y+20); cx+=colW[head.indexOf(h)]; });
    this.y+=headH;
    rows.forEach((r,ri)=>{
      if(this.y+rowH>this.H-40) this.newPage();
      if(ri%2===1) this.box(x0,this.y,totalW,rowH,'#f7f8fa');
      this.f(size,false); this.ctx.fillStyle='#1a1a1a';
      let cx=x0; r.forEach((v,i)=>{ this.ctx.textAlign='left'; this.ctx.fillText(this._clip(String(v==null?'':v),colW[i]-14,size),cx+8,this.y+19); cx+=colW[i]; });
      this.ctx.strokeStyle='#e5e7eb'; this.ctx.lineWidth=.5; this.ctx.strokeRect(x0,this.y,totalW,rowH);
      this.y+=rowH;
    });
  },
  _clip(s,w,sz){ this.ctx.font='400 '+sz+'px '+this._fonts;
    if(this.ctx.measureText(s).width<=w) return s;
    let r=s; while(r.length>1&&this.ctx.measureText(r+'…').width>w) r=r.slice(0,-1);
    return r+'…'; },
  _wrap(s,w,sz){ this.ctx.font='400 '+(sz||12)+'px '+this._fonts; const out=[]; let cur='';
    for(const ch of String(s)){ if(this.ctx.measureText(cur+ch).width>w){ out.push(cur); cur=ch; } else cur+=ch; }
    if(cur)out.push(cur); return out.length?out:['']; },
  save(name){ if(this.cv) this.doc.addImage(this.cv.toDataURL('image/png'),'PNG',0,0,595.28,841.89); this.doc.save(name); }
};

/* ============================== 启动 ============================== */
function boot(){
  loadDB();
  bindLogin();
  const savedId=localStorage.getItem(LS_USR);
  if(savedId){const u=DB.users.find(x=>x.id===savedId);if(u){currentUser=u;renderApp();return}}
  $('#loginPage').style.display='flex';
}
