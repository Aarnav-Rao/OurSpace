-- OurSpace schema. Run once in Supabase > SQL editor.
create extension if not exists pgcrypto;
create table profiles(id uuid primary key references auth.users on delete cascade, display_name text not null default 'Me', avatar_path text);
create table workspaces(id uuid primary key default gen_random_uuid(), name text not null default 'Us', together_since date,
  invite_code text unique not null default encode(gen_random_bytes(4),'hex'), created_at timestamptz default now());
create table members(workspace_id uuid references workspaces on delete cascade, user_id uuid references auth.users on delete cascade, primary key(workspace_id,user_id));
create unique index one_space_per_user on members(user_id);
create table questions(id serial primary key, text text not null);
create table answers(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade,
  user_id uuid not null default auth.uid() references auth.users, question_id int references questions, day date not null, body text not null, unique(workspace_id,user_id,day));
create table moods(workspace_id uuid references workspaces on delete cascade, user_id uuid default auth.uid() references auth.users, day date, mood text not null, message text, primary key(workspace_id,user_id,day));
create table notes(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid not null default auth.uid() references auth.users, body text not null, created_at timestamptz default now());
create table memories(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references workspaces on delete cascade, user_id uuid not null default auth.uid() references auth.users,
  title text not null, description text, location text, taken_on date not null default current_date, photo_path text, created_at timestamptz default now());
create index on memories(workspace_id, taken_on desc);

create function is_member(w uuid) returns boolean language sql security definer stable set search_path=public as $$ select exists(select 1 from members where workspace_id=w and user_id=auth.uid()) $$;
create function shares_space(u uuid) returns boolean language sql security definer stable set search_path=public as $$
  select exists(select 1 from members a join members b on a.workspace_id=b.workspace_id where a.user_id=auth.uid() and b.user_id=u) $$;
create function both_answered(w uuid, d date) returns boolean language sql security definer stable set search_path=public as $$
  select count(distinct user_id)=2 from answers where workspace_id=w and day=d $$;
create function create_workspace(n text, since date) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; begin insert into workspaces(name,together_since) values(coalesce(n,'Us'),since) returning id into w; insert into members values(w,auth.uid()); return w; end $$;
create function join_workspace(code text) returns uuid language plpgsql security definer set search_path=public as $$
declare w uuid; begin select id into w from workspaces where invite_code=code;
  if w is null then raise exception 'Invalid invite code'; end if;
  if (select count(*) from members where workspace_id=w)>=2 then raise exception 'This space already has two people'; end if;
  insert into members values(w,auth.uid()); return w; end $$;
create function new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,display_name) values(new.id, split_part(new.email,'@',1)); return new; end $$;
create trigger on_signup after insert on auth.users for each row execute function new_user();

alter table profiles enable row level security; alter table workspaces enable row level security; alter table members enable row level security;
alter table questions enable row level security; alter table answers enable row level security; alter table moods enable row level security;
alter table notes enable row level security; alter table memories enable row level security;
create policy p_sel on profiles for select using (id=auth.uid() or shares_space(id));
create policy p_upd on profiles for update using (id=auth.uid());
create policy w_sel on workspaces for select using (is_member(id));
create policy w_upd on workspaces for update using (is_member(id));
create policy m_sel on members for select using (is_member(workspace_id));
create policy q_sel on questions for select to authenticated using (true);
create policy a_sel on answers for select using (is_member(workspace_id) and (user_id=auth.uid() or both_answered(workspace_id,day)));
create policy a_ins on answers for insert with check (is_member(workspace_id) and user_id=auth.uid());
create policy mo_sel on moods for select using (is_member(workspace_id));
create policy mo_ins on moods for insert with check (is_member(workspace_id) and user_id=auth.uid());
create policy mo_upd on moods for update using (user_id=auth.uid()) with check (is_member(workspace_id) and user_id=auth.uid());
create policy n_sel on notes for select using (is_member(workspace_id));
create policy n_ins on notes for insert with check (is_member(workspace_id) and user_id=auth.uid());
create policy n_del on notes for delete using (user_id=auth.uid());
create policy me_all on memories for all using (is_member(workspace_id)) with check (is_member(workspace_id));

insert into storage.buckets(id,name,public) values('photos','photos',false);
create policy ph_all on storage.objects for all
  using (bucket_id='photos' and is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id='photos' and is_member(((storage.foldername(name))[1])::uuid));

alter publication supabase_realtime add table notes, moods, answers, memories;
insert into questions(text) values
('What’s one little thing I did recently that made you smile?'),('Where would you take me if we could travel tomorrow?'),
('What’s something you want us to experience together?'),('What’s your favourite memory of us?'),
('What’s a small ritual of ours you never want to lose?'),('What did you first notice about me?'),
('What’s something I do that makes you feel looked after?'),('What are you looking forward to this month?'),
('What’s a song that reminds you of us?'),('What’s one thing you’d like us to try this year?');
