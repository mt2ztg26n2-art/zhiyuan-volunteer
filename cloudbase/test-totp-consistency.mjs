/* 验证：云函数 TOTP 与 app.js 真实前端 computeTOTP 完全一致
 * 方法：从 app.js 原样提取 sha1/hmacSha1/hexToBytes/computeTOTP，
 *       与 Node crypto 版（云函数实现）对比多密钥×多时间点。
 * 运行：node cloudbase/test-totp-consistency.mjs
 */
import { createHmac } from 'node:crypto';

/* ---------- app.js 原样函数（勿改） ---------- */
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
function wordsToBytes(h){const b=[];h.forEach(x=>{b.push((x>>>24)&0xff,(x>>>16)&0xff,(x>>>8)&0xff,x&0xff)});return b}
function hmacSha1(key,msg){
  const block=64;let k=key.slice();
  if(k.length>block)k=wordsToBytes(sha1(k));
  while(k.length<block)k.push(0);
  const oKey=new Array(block),iKey=new Array(block);
  for(let i=0;i<block;i++){oKey[i]=k[i]^0x5c;iKey[i]=k[i]^0x36;}
  const inner=wordsToBytes(sha1(iKey.concat(msg)));
  return sha1(oKey.concat(inner));
}
function hexToBytes(h){const a=[];for(let i=0;i<h.length;i+=2)a.push(parseInt(h.substr(i,2),16));return a}
function computeTOTPAt(secretHex, ts){
  const t=Math.floor(ts/300000), msg=new Array(8);
  let v=t;for(let i=7;i>=0;i--){msg[i]=v&0xff;v=Math.floor(v/256);}
  const h=hmacSha1(hexToBytes(secretHex),msg);
  const b=[];h.forEach(x=>{b.push((x>>>24)&0xff,(x>>>16)&0xff,(x>>>8)&0xff,x&0xff)});
  const off=b[19]&0x0f;
  const binCalc=(((b[off]&0x7f)<<24)|((b[off+1]&0xff)<<16)|((b[off+2]&0xff)<<8)|(b[off+3]&0xff))>>>0;
  return String(binCalc%1000000).padStart(6,'0');
}

/* ---------- 云函数实现（Node crypto，来自 zy-api/index.js totpAt） ---------- */
function totpCloud(secretHex, ts){
  const step = 300000; // 5 分钟（毫秒），与前端一致
  const t=Math.floor(ts/step), msg=new Array(8);
  let v=t;for(let i=7;i>=0;i--){msg[i]=v&0xff;v=Math.floor(v/256);}
  const key=Buffer.from(String(secretHex||''),'hex');
  const h=createHmac('sha1', key).update(Buffer.from(msg)).digest();
  const b=Array.from(h);
  const off=b[19]&0x0f;
  const bin=(((b[off]&0x7f)<<24)|((b[off+1]&0xff)<<16)|((b[off+2]&0xff)<<8)|(b[off+3]&0xff))>>>0;
  return String(bin%1000000).padStart(6,'0');
}

let pass=0, fail=0;
const secrets=['a1b2c3d4e5f60718293a4b5c6d7e8f90','deadbeefdeadbeefdeadbeefdeadbeef','0123456789abcdef0123456789abcdef'];
const now=Date.now();
const times=[now, now+300000, now-300000, now+600000, 0, 1234567890123];
for(const s of secrets){
  for(const ts of times){
    const c=totpCloud(s,ts);
    const f=computeTOTPAt(s,ts);
    if(c===f){pass++;}else{fail++;console.log('  MISMATCH',s,ts,'cloud='+c,'fe='+f);}
  }
}
console.log(fail===0?`[OK] TOTP 一致性全部通过 (${pass} 组一致)`:`[X] ${fail} 组不一致`);
process.exit(fail===0?0:1);
