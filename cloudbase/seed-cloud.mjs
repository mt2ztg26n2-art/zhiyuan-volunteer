/* 云端重置为合法种子库（3 系统账号 + 词典 + 空业务数组）
 * 加密参数与前端 zy-sync.js 完全一致
 * 运行：node seed-cloud.mjs
 */
import { webcrypto } from 'node:crypto';
const crypto = webcrypto;
const PASS = 'zhiyuan-sync-2026-v1';
const SALT = 'zy-sync-v2';
const ITER = 120000;
const URL = 'https://naqcaaktfqdvsanghqbm.supabase.co';
const KEY = 'sb_publishable_c-JchQzWlsLLz9N_HJoO3A_dDAqc1dB';

const seed = {
  school:'四川省宣汉职业中专学校', schoolShort:'宣汉职校',
  league:'中国共产主义青年团宣汉职业中专学校委员会', leagueShort:'校团委',
  period:'2026 秋季学期',
  users:[
    {id:'u-super',role:'super',org:'超级管理员',name:'系统管理员',idCard:'000000000000000001',pwd:'admin123',phone:'13900000001',email:'admin@xhzx.edu.cn',title:'超级管理员',avatar:'',dept:'',cls:'',gender:'男',nation:'汉族',politics:'中共党员',position:'会长',activated:true},
    {id:'u-term',role:'terminal',org:'校团委',name:'终端管理员',idCard:'000000000000000002',pwd:'term123',phone:'13900000002',title:'系统维护',avatar:'',dept:'',cls:'',gender:'男',nation:'汉族',politics:'中共党员',position:'系统维护',activated:true},
    {id:'u-dev',role:'dev',org:'开发人员',name:'开发维护',idCard:'000000000000000099',pwd:'dev123',phone:'13900000099',title:'系统开发',avatar:'',dept:'',cls:'',gender:'男',nation:'汉族',politics:'群众',position:'系统开发',activated:true}
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
  services:[], activities:[], tasks:[], news:[], notifies:[],
  broadcastRecs:[], etiquetteRecs:[], subleagueRecs:[],
  quotas:[], logs:[], reports:[], summaries:[], traces:[],
  others:[], evaluations:[],
  nextIds:{user:200,service:100,activity:10,task:10,news:10,notify:10,summary:10,report:10},
  _seedV:3
};

async function deriveKey(){
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(PASS), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt:enc.encode(SALT), iterations:ITER, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
  );
}
function bufToB64(buf){ let s=''; const ch=0x8000; for(let i=0;i<buf.length;i+=ch) s+=String.fromCharCode.apply(null,buf.subarray(i,i+ch)); return btoa(s); }
async function encrypt(obj){
  const key=await deriveKey(); const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv}, key, new TextEncoder().encode(JSON.stringify(obj)));
  const out=new Uint8Array(12+ct.byteLength); out.set(iv,0); out.set(new Uint8Array(ct),12);
  return bufToB64(out);
}

const enc = await encrypt(seed);
console.log('密文长度:', enc.length, '字节');
const r = await fetch(URL + '/rest/v1/zy_db', {
  method:'POST',
  headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'},
  body: JSON.stringify({id:1, data: enc})
});
console.log('上传 HTTP:', r.status);
const rows = await r.json().catch(()=>null);
console.log('云端回读确认:', Array.isArray(rows) && rows.length ? '写入成功' : '异常', rows ? JSON.stringify(rows[0]||{}).slice(0,80) : '');
