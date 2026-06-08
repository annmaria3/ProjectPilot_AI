
-- Enums
create type public.workspace_role as enum ('owner', 'admin', 'member');
create type public.module_status as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.event_kind as enum ('commit', 'pr_opened', 'pr_merged', 'pr_closed', 'manual', 'ai');

-- Workspaces
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null,
  role public.workspace_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index on public.workspace_members (user_id);
create index on public.workspace_members (workspace_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'member',
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (workspace_id, email)
);

-- Profiles (display info)
create table public.profiles (
  id uuid primary key,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text not null default '',
  skills text not null default '',
  team_size int not null default 3,
  duration_weeks int not null default 12,
  budget int not null default 10,
  skill_level int not null default 5,
  start_date date not null default current_date,
  github_repo text,
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.projects (workspace_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text not null,
  name text not null,
  status public.module_status not null default 'todo',
  progress int not null default 0,
  depends_on text[] not null default '{}',
  owner_id uuid,
  branch_keywords text[] not null default '{}',
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, slug)
);
create index on public.modules (project_id);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  module_id uuid references public.modules(id) on delete set null,
  kind public.event_kind not null,
  actor text,
  summary text not null,
  url text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_events (project_id, created_at desc);

-- Grants
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.workspace_members to authenticated;
grant select, insert, update, delete on public.workspace_invitations to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.modules to authenticated;
grant select, insert on public.activity_events to authenticated;
grant all on public.workspaces, public.workspace_members, public.workspace_invitations,
  public.profiles, public.projects, public.modules, public.activity_events to service_role;

-- Security definer helper
create or replace function public.is_workspace_member(_user uuid, _workspace uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members where user_id = _user and workspace_id = _workspace)
$$;

create or replace function public.workspace_role_of(_user uuid, _workspace uuid)
returns public.workspace_role language sql stable security definer set search_path = public as $$
  select role from public.workspace_members where user_id = _user and workspace_id = _workspace
$$;

create or replace function public.project_workspace(_project uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select workspace_id from public.projects where id = _project
$$;

-- RLS
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.modules enable row level security;
alter table public.activity_events enable row level security;

-- workspaces
create policy "members read workspace" on public.workspaces for select to authenticated
  using (public.is_workspace_member(auth.uid(), id));
create policy "auth create workspace" on public.workspaces for insert to authenticated
  with check (created_by = auth.uid());
create policy "owners update workspace" on public.workspaces for update to authenticated
  using (public.workspace_role_of(auth.uid(), id) in ('owner','admin'));
create policy "owners delete workspace" on public.workspaces for delete to authenticated
  using (public.workspace_role_of(auth.uid(), id) = 'owner');

-- workspace_members
create policy "read own memberships" on public.workspace_members for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(auth.uid(), workspace_id));
create policy "self insert membership" on public.workspace_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "admins manage members" on public.workspace_members for update to authenticated
  using (public.workspace_role_of(auth.uid(), workspace_id) in ('owner','admin'));
create policy "admins remove members" on public.workspace_members for delete to authenticated
  using (public.workspace_role_of(auth.uid(), workspace_id) in ('owner','admin') or user_id = auth.uid());

-- invitations
create policy "members read invites" on public.workspace_invitations for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "admins create invites" on public.workspace_invitations for insert to authenticated
  with check (public.workspace_role_of(auth.uid(), workspace_id) in ('owner','admin') and invited_by = auth.uid());
create policy "admins delete invites" on public.workspace_invitations for delete to authenticated
  using (public.workspace_role_of(auth.uid(), workspace_id) in ('owner','admin'));

-- profiles
create policy "read all profiles" on public.profiles for select to authenticated using (true);
create policy "self upsert profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "self update profile" on public.profiles for update to authenticated using (id = auth.uid());

-- projects
create policy "members read projects" on public.projects for select to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "members insert projects" on public.projects for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), workspace_id) and created_by = auth.uid());
create policy "members update projects" on public.projects for update to authenticated
  using (public.is_workspace_member(auth.uid(), workspace_id));
create policy "admins delete projects" on public.projects for delete to authenticated
  using (public.workspace_role_of(auth.uid(), workspace_id) in ('owner','admin'));

-- modules
create policy "members read modules" on public.modules for select to authenticated
  using (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));
create policy "members write modules" on public.modules for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));
create policy "members update modules" on public.modules for update to authenticated
  using (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));
create policy "members delete modules" on public.modules for delete to authenticated
  using (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));

-- activity events
create policy "members read events" on public.activity_events for select to authenticated
  using (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));
create policy "members insert events" on public.activity_events for insert to authenticated
  with check (public.is_workspace_member(auth.uid(), public.project_workspace(project_id)));

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger trg_workspaces_updated before update on public.workspaces
  for each row execute function public.touch_updated_at();
create trigger trg_projects_updated before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger trg_modules_updated before update on public.modules
  for each row execute function public.touch_updated_at();
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create profile + default workspace on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_ws uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.workspaces (name, created_by)
  values (coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)) || '''s Workspace', new.id)
  returning id into new_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_ws, new.id, 'owner');

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Auto-accept invitations on signup
create or replace function public.accept_invitations_for_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  select i.workspace_id, new.id, i.role
  from public.workspace_invitations i
  where lower(i.email) = lower(new.email) and i.accepted_at is null
  on conflict do nothing;

  update public.workspace_invitations
  set accepted_at = now()
  where lower(email) = lower(new.email) and accepted_at is null;
  return new;
end $$;

create trigger on_auth_user_accept_invites
  after insert on auth.users for each row execute function public.accept_invitations_for_user();

-- Realtime
alter publication supabase_realtime add table public.modules;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.activity_events;
alter publication supabase_realtime add table public.workspace_members;
