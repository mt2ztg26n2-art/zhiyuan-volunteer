-- ============================================================
-- 宣汉职校志愿服务平台 · Supabase 云端同步建表脚本
-- 在 Supabase 控制台 (SQL Editor) 中整段执行一次即可（约 1 分钟）。
-- 作用：创建全平台共享的云端账本表 + 行级安全(RLS)策略。
-- ============================================================

-- 1) 云端账本表：id=1 固定一行，data 存整个平台数据的加密 JSON
--    （明文密码 / 身份证号等敏感信息在写入前由前端 AES-GCM 加密，
--      云端只保存密文，即使数据被公开读取也无法解读）
create table if not exists public.zy_db (
  id         int         primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 预置一行（id=1）
insert into public.zy_db (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- 3) 开启行级安全：默认任何请求都读不到数据，必须命中下面的策略
alter table public.zy_db enable row level security;

-- 4) 策略：只有已登录 Supabase 的用户才能读写这一行
--    （这样匿名请求无法覆盖/删除云端数据，防止被人恶意清库）
drop policy if exists "zy_auth_rw" on public.zy_db;
create policy "zy_auth_rw" on public.zy_db
  for all
  using     ( auth.role() = 'authenticated' )
  with check ( auth.role() = 'authenticated' );

-- 5) 触发器：每次更新自动刷新 updated_at（用于判断哪边更新更新，实现多设备合并）
create or replace function public.touch_zy_updated() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_zy_updated on public.zy_db;
create trigger trg_zy_updated
  before update on public.zy_db
  for each row execute function public.touch_zy_updated();

-- 完成。执行后可在 Table Editor 看到 zy_db 表（id=1 一行）。
-- 下一步：在平台「系统设置 → 云端同步」里，
--   ① 填入你的 Supabase 项目地址与匿名密钥（下面两行）
--   ② 填一个用于云端同步的专属账号（邮箱+密码），
--      首次保存时系统会自动用该账号登录并把本地数据上传到云端。
-- 所有设备填入相同配置后，即实现跨设备实时同步。
