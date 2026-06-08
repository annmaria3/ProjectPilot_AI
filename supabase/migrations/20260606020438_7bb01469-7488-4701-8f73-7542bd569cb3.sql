
alter function public.is_workspace_member(uuid, uuid) set search_path = public;
alter function public.workspace_role_of(uuid, uuid) set search_path = public;
alter function public.project_workspace(uuid) set search_path = public;
alter function public.touch_updated_at() set search_path = public;
