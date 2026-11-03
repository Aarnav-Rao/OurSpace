-- OurSpace migration 002. Safe to run on top of schema.sql. Does not drop or alter existing data.
create table if not exists events(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users,
  title text not null, description text, kind text not null default 'date' check (kind in ('birthday','anniversary','date','trip','personal')),
  starts_on date not null, ends_on date, yearly boolean not null default false, remind_days int not null default 0, created_at timestamptz default now());
create table if not exists albums(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users,
  name text not null, description text, created_at timestamptz default now());
alter table memories add column if not exists album_id uuid references albums on delete set null;
alter table albums add column if not exists cover_memory_id uuid references memories on delete set null;
create index if not exists memories_album_idx on memories(album_id);
create table if not exists bucket_items(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users,
  title text not null, description text, category text not null default 'Adventures', priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'planned' check (status in ('planned','in_progress','completed')), photo_path text, completed_on date,
  memory_id uuid references memories on delete set null, created_at timestamptz default now());
create table if not exists date_ideas(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users,
  title text not null, description text, location text, budget numeric, setting text not null default 'outdoor' check (setting in ('indoor','outdoor')),
  minutes int, kind text, done_on date, memory_id uuid references memories on delete set null, created_at timestamptz default now());
create table if not exists milestones(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users,
  title text not null, on_date date not null, yearly boolean not null default false, kind text not null default 'custom', note text, created_at timestamptz default now());
do $$ declare t text; begin
  foreach t in array array['events','albums','bucket_items','date_ideas','milestones'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_all', t);
    execute format('create policy %I on %I for all using (is_member(workspace_id)) with check (is_member(workspace_id))', t || '_all', t);
    execute format('create index if not exists %I on %I(workspace_id)', t || '_ws_idx', t);
  end loop; end $$;
-- Realtime: DELETE events only carry the workspace_id filter column with REPLICA IDENTITY FULL.
do $$ declare t text; begin
  foreach t in array array['events','albums','bucket_items','date_ideas','milestones','notes','moods','answers','memories'] loop
    execute format('alter table %I replica identity full', t);
    begin execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then null; end;
  end loop; end $$;

-- Security hardening of the original schema
drop policy if exists a_ins on answers;
create policy a_ins on answers for insert with check (is_member(workspace_id) and user_id = auth.uid() and day between current_date - 1 and current_date + 1);
create or replace function join_workspace(code text) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; begin
  select id into w from workspaces where invite_code = code for update;
  if w is null then raise exception 'Invalid invite code'; end if;
  if (select count(*) from members where workspace_id = w) >= 2 then raise exception 'This space already has two people'; end if;
  insert into members values (w, auth.uid()); return w; end $$;
revoke execute on function create_workspace(text, date), join_workspace(text) from public, anon;
grant execute on function create_workspace(text, date), join_workspace(text) to authenticated;
-- Profile photos and all other photos reuse the private 'photos' bucket; paths start with the workspace id, so the existing storage policy already covers them.
