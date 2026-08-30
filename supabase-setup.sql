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

-- ============================================================
-- 【追加 · 第 2 段】注册审核云端通道（手机注册 → 电脑审核）
-- 在 SQL Editor 中，把下面这段也整段执行一次即可。
-- 作用：创建「注册队列」表，手机端提交的注册申请直接进入云端，
--      管理员电脑端自动拉取并显示在「审核中心」。
-- ============================================================
create table if not exists public.zy_regs (
  id         bigint generated always as identity primary key,
  payload    text         not null,   -- 注册数据（AES 加密存储）
  created_at timestamptz  default now()
);
alter table public.zy_regs enable row level security;
-- 1) 任何人（含未登录的手机注册者）都可以提交注册申请（只能写，不能读）
drop policy if exists "zy_regs_anon_insert" on public.zy_regs;
create policy "zy_regs_anon_insert" on public.zy_regs
  for insert with check ( true );
-- 2) 只有已登录 Supabase 的管理员账号才能读取注册列表（防止注册信息被公开读取）
drop policy if exists "zy_regs_auth_select" on public.zy_regs;
create policy "zy_regs_auth_select" on public.zy_regs
  for select using ( auth.role() = 'authenticated' );
-- 3) 只有管理员能删除（审核处理完的条目）
drop policy if exists "zy_regs_auth_delete" on public.zy_regs;
create policy "zy_regs_auth_delete" on public.zy_regs
  for delete using ( auth.role() = 'authenticated' );
-- 完成。执行后 Table Editor 会看到 zy_regs 表（初始为空）。
-- 然后：手机端志愿者注册提交 → 自动进入这张表 → 电脑端管理员打开「审核中心」即可看到。

-- ============================================================
-- 【追加 · 第 3 段】审核结果状态表（注册者自查审核结果）
-- 在 SQL Editor 中，把下面这段也整段执行一次即可。
-- 作用：管理员审核通过/驳回后，把结果写入此表；
--      手机端注册者重新打开登录页时，自动查询并提示「已通过/已驳回」，
--      通过后即可用注册时设置的密码直接登录。
-- 安全：此表只存「身份证号 + 审核状态」两个字段，不含任何敏感信息。
-- ============================================================
create table if not exists public.zy_status (
  id_card    text        primary key,
  status     text        not null,      -- approved=已通过 / rejected=已驳回
  updated_at timestamptz default now()
);
alter table public.zy_status enable row level security;
-- 只有身份证号+审核结果，无敏感信息，允许公开读取（注册者自查需要）
drop policy if exists "zy_status_public" on public.zy_status;
create policy "zy_status_public" on public.zy_status
  for all using ( true );
-- 完成。执行后 Table Editor 会看到 zy_status 表（初始为空）。
-- 流程：注册提交（zy_regs）→ 管理员审核 → 写入 zy_status → 注册者登录页自动提示结果。
