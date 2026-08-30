/* =========================================================
 * 迁移脚本：Supabase 密文 → CloudBase 可导入 JSON
 * 用法：
 *   node migrate-supabase-to-cloudbase.mjs <supabase_db_json_file> [output.json]
 * 说明：
 *   - 输入为 Supabase zy_db 表中 data 列的密文字符串（可整行或 JSON 包装）
 *   - 解密密钥与前端 zy-sync.js 一致（pass=zhiyuan-sync-2026-v1, salt=zy-sync-v2,
 *     PBKDF2 120k, AES-GCM 256）
 *   - 输出：把明文密码字段 pwd 转为 bcrypt 哈希（与云函数 actLogin 兼容），
 *     生成 import.json 供云函数 import action 使用
 * ========================================================= */
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const crypto = webcrypto;
const PASS = 'zhiyuan-sync-2026-v1';
const SALT = 'zy-sync-v2';
const ITER = 120000;

function b64ToBuf(b64){ return Buffer.from(b64, 'base64'); }
function bufToB64(buf){ return Buffer.from(buf).toString('base64'); }

async function deriveKey(){
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey('raw', enc.encode(PASS), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt:enc.encode(SALT), iterations:ITER, hash:'SHA-256'},
    base, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']
  );
}
async function decrypt(str){
  const key = await deriveKey();
  const raw = b64ToBuf(str);
  const iv = raw.slice(0,12);
  const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* 简易 bcrypt：本脚本不依赖 bcryptjs，密码转 bcrypt 由云函数 import 时自动完成
 * （云函数部署时自动安装 bcryptjs，导入时对非 bcrypt 格式的 pwd 自动哈希） */
function hashPwdPlaceholder(){ throw new Error('不应调用：密码转 bcrypt 由云函数 import 自动处理'); }

function main(){
  const input = process.argv[2];
  const output = process.argv[3] || path.join(process.cwd(), 'cloudbase', 'seed-db.json');
  if(!input){ console.log('用法: node migrate-supabase-to-cloudbase.mjs <密文文件> [输出.json]'); process.exit(1); }
  const raw = fs.readFileSync(input, 'utf-8').trim();
  let cipher = raw;
  /* 若文件是 Supabase REST 响应（[{data:"..."}]）或 {"data":"..."}，提取 data 字段 */
  try{
    const j = JSON.parse(raw);
    if(Array.isArray(j) && j[0] && typeof j[0].data==='string') cipher = j[0].data;
    else if(j && typeof j.data==='string') cipher = j.data;
  }catch(e){ /* 纯密文串 */ }
  decrypt(cipher).then(async db=>{
    console.log('[i] 解密成功，users=' + (db.users||[]).length + ' 条');
    /* 密码保持原样，云函数 import 时自动转为 bcrypt；补充 totpSecret */
    (db.users||[]).forEach(u=>{
      if(u && !u.totpSecret){ u.totpSecret = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b=>b.toString(16).padStart(2,'0')).join(''); }
    });
    console.log('[i] 已补充 totpSecret（密码转 bcrypt 由云函数 import 自动处理）');
    fs.writeFileSync(output, JSON.stringify(db, null, 2), 'utf-8');
    console.log('[OK] 迁移数据已写出: ' + output);
    console.log('     下一步：把该文件内容作为 import action 的 db 参数上传到云函数（仅超级/终端/开发可执行）');
  }).catch(e=>{
    console.error('[X] 解密失败:', e.message);
    console.error('    请确认输入是 Supabase zy_db 的 data 列原始密文，且版本密钥与 zy-sync.js 一致');
    process.exit(1);
  });
}
main();
