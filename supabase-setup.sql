-- ============================================================
-- 宣汉职校志愿服务平台 · Supabase 云端同步建表脚本（最终版 v2）
-- 在 Supabase 控制台 (SQL Editor) 中整段执行一次即可（约 1 分钟）。
-- 已执行过旧版本的，直接再跑一遍即可（幂等，自动更新）。
-- 作用：创建云端账本 + 注册队列 + 审核状态三张表，全部零配置全设备自动同步。
-- ============================================================

-- 1) 云端账本表：id=1 固定一行，data 存整个平台数据的加密 JSON
create table if not exists public.zy_db (
  id         int         primary key,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.zy_db (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;
alter table public.zy_db enable row level security;
-- 零配置：匿名可读写（数据为密文，权限隔离靠应用层角色/部门规则）
drop policy if exists "zy_db_public" on public.zy_db;
create policy "zy_db_public" on public.zy_db
  for all using ( true );
-- updated_at 触发器（用于多设备合并判断）
create or replace function public.touch_zy_updated() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists trg_zy_updated on public.zy_db;
create trigger trg_zy_updated
  before update on public.zy_db
  for each row execute function public.touch_zy_updated();

-- 2) 注册队列表：手机端注册提交进这里，电脑端管理员自动拉取审核
create table if not exists public.zy_regs (
  id         bigint generated always as identity primary key,
  payload    text         not null,   -- 注册数据（AES 加密，不含密码）
  created_at timestamptz  default now()
);
alter table public.zy_regs enable row level security;
drop policy if exists "zy_regs_public" on public.zy_regs;
create policy "zy_regs_public" on public.zy_regs
  for all using ( true );

-- 3) 审核结果状态表：注册者自查（通过后即可登录）
create table if not exists public.zy_status (
  id_card    text        primary key,
  status     text        not null,      -- approved=已通过 / rejected=已驳回
  updated_at timestamptz default now()
);
alter table public.zy_status enable row level security;
drop policy if exists "zy_status_public" on public.zy_status;
create policy "zy_status_public" on public.zy_status
  for all using ( true );

-- 完成。执行后 Table Editor 会看到 zy_db / zy_regs / zy_status 三张表。
-- 无需任何配置，所有设备、所有用户打开即自动同步。
