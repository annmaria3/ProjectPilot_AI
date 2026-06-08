import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
  type Dispatch,
  type SetStateAction
} from "react";
import { supabase } from "@/integration/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type ModuleStatus = "done" | "in_progress" | "blocked" | "todo";

export interface ProjectModule {
  id: string;
  slug: string;
  name: string;
  status: ModuleStatus;
  progress: number;
  dependsOn: string[];
  ownerId: string | null;
  branchKeywords: string[];
  position: number;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  skills: string;
  teamSize: number;
  durationWeeks: number;
  budget: number;
  skillLevel: number;
  startDate: string;
  githubRepo: string | null;
  webhookSecret: string;
  modules: ProjectModule[];
}

export interface Workspace {
  id: string;
  name: string;
}

export interface WorkspaceMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface ActivityEvent {
  id: string;
  kind: string;
  summary: string;
  actor: string | null;
  url: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  module_id: string;
  title: string;
  completed: boolean;
}

interface Ctx {
  loading: boolean;
  user: User | null;
  session: Session | null;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
  members: WorkspaceMember[];
  projects: Pick<Project, "id" | "name">[];
  activeProjectId: string | null;
  setActiveProject: (id: string) => void;
  project: Project | null;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  /** Legacy alias for `project` — only safe to read when a project is loaded. */
  state: Project;
  events: ActivityEvent[];
  updateProject: (patch: Partial<Project>) => Promise<void>;
  /** Legacy alias for updateProject */
  update: (patch: Partial<Project>) => Promise<void>;
  updateModule: (id: string, patch: Partial<ProjectModule>) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProject: () => Promise<void>;
}

const ProjectCtx = createContext<Ctx | null>(null);
const ACTIVE_WS_KEY = "pp.active.ws";
const ACTIVE_PR_KEY = "pp.active.project";

function mapProject(row: any, modules: any[]): Project {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    description: row.description ?? "",
    skills: row.skills ?? "",
    teamSize: row.team_size,
    durationWeeks: row.duration_weeks,
    budget: row.budget,
    skillLevel: row.skill_level,
    startDate: row.start_date,
    githubRepo: row.github_repo,
    webhookSecret: row.webhook_secret,
    modules: modules
      .sort((a, b) => a.position - b.position)
      .map((m) => ({
        id: m.id,
        slug: m.slug,
        name: m.name,
        status: m.status,
        progress: m.progress,
        dependsOn: m.depends_on ?? [],
        ownerId: m.owner_id,
        branchKeywords: m.branch_keywords ?? [],
        position: m.position,
      })),
  };
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Auth bootstrap
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load workspaces
  useEffect(() => {
    if (!user) {
      setWorkspaces([]); setProjects([]); setProject(null);
      setActiveWorkspaceIdState(null); setActiveProjectIdState(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces!inner(id, name)")
        .eq("user_id", user.id);
      const ws = (data ?? []).map((r: any) => ({ id: r.workspaces.id, name: r.workspaces.name }));
      setWorkspaces(ws);
      const saved = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_WS_KEY) : null;
      const chosen = ws.find((w) => w.id === saved)?.id ?? ws[0]?.id ?? null;
      setActiveWorkspaceIdState(chosen);
    })();
  }, [user]);

  // Load members + projects for workspace
  useEffect(() => {
    if (!activeWorkspaceId) { setMembers([]); setProjects([]); return; }
    (async () => {
      const [m, p] = await Promise.all([
        supabase
          .from("workspace_members")
          .select("user_id, role, profiles!inner(email, display_name, avatar_url)")
          .eq("workspace_id", activeWorkspaceId),
        supabase
          .from("projects")
          .select("id, name")
          .eq("workspace_id", activeWorkspaceId)
          .order("created_at", { ascending: false }),
      ]);
      setMembers(
        (m.data ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role,
          email: r.profiles?.email ?? null,
          display_name: r.profiles?.display_name ?? null,
          avatar_url: r.profiles?.avatar_url ?? null,
        })),
      );
      const pj = p.data ?? [];
      setProjects(pj);
      const saved = typeof window !== "undefined" ? localStorage.getItem(ACTIVE_PR_KEY) : null;
      const chosen = pj.find((x) => x.id === saved)?.id ?? pj[0]?.id ?? null;
      setActiveProjectIdState(chosen);
    })();
  }, [activeWorkspaceId]);

  const refreshProject = useCallback(async () => {
    if (!activeProjectId) { setProject(null); setEvents([]); return; }
    console.log("ACTIVE PROJECT:", activeProjectId);
    const [
      { data: p },
      { data: mods },
      { data: ev },
      { data: taskData },
    ] = await Promise.all([
      supabase
        .from("projects")
        .select("*")
        .eq("id", activeProjectId)
        .maybeSingle(),

      supabase
        .from("modules")
        .select("*")
        .eq("project_id", activeProjectId),

      supabase
        .from("activity_events")
        .select("id, kind, summary, actor, url, created_at")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: false })
        .limit(50),

      supabase
        .from("tasks")
        .select(`
          *,
          modules!inner(project_id)
        `)
        .eq("modules.project_id", activeProjectId)
        .order("created_at", { ascending: false }),
    ]);

    console.log("RAW TASK QUERY:", taskData);
    setProject(p ? mapProject(p, mods ?? []) : null);
    setEvents(ev ?? []);
    setTasks(taskData ?? []);
    console.log("TASKS:", taskData);
  }, [activeProjectId]);

  useEffect(() => { refreshProject(); }, [refreshProject]);

  // Realtime
  useEffect(() => {
    if (!activeProjectId) return;
    const ch = supabase
      .channel(`project-${activeProjectId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "modules", filter: `project_id=eq.${activeProjectId}` },
        () => refreshProject())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: `id=eq.${activeProjectId}` },
        () => refreshProject())
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_events", filter: `project_id=eq.${activeProjectId}` },
        () => refreshProject())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeProjectId, refreshProject]);

  const setActiveWorkspace = (id: string) => {
    setActiveWorkspaceIdState(id);
    try { localStorage.setItem(ACTIVE_WS_KEY, id); } catch {}
  };
  const setActiveProject = (id: string) => {
    setActiveProjectIdState(id);
    try { localStorage.setItem(ACTIVE_PR_KEY, id); } catch {}
  };

  const updateProject = async (patch: Partial<Project>) => {
    if (!project) return;
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.skills !== undefined) dbPatch.skills = patch.skills;
    if (patch.teamSize !== undefined) dbPatch.team_size = patch.teamSize;
    if (patch.durationWeeks !== undefined) dbPatch.duration_weeks = patch.durationWeeks;
    if (patch.budget !== undefined) dbPatch.budget = patch.budget;
    if (patch.skillLevel !== undefined) dbPatch.skill_level = patch.skillLevel;
    if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate;
    if (patch.githubRepo !== undefined) dbPatch.github_repo = patch.githubRepo;
    setProject({ ...project, ...patch });
    await supabase.from("projects").update(dbPatch).eq("id", project.id);
  };

  const updateModule = async (id: string, patch: Partial<ProjectModule>) => {
    if (!project) return;
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.progress !== undefined) dbPatch.progress = patch.progress;
    if (patch.ownerId !== undefined) dbPatch.owner_id = patch.ownerId;
    setProject({
      ...project,
      modules: project.modules.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    });
    await supabase.from("modules").update(dbPatch).eq("id", id);
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const value = useMemo<Ctx>(() => ({
    loading, user, session, workspaces, activeWorkspaceId, setActiveWorkspace,
    tasks,setTasks,
    members, projects, activeProjectId, setActiveProject,
    project, state: project as Project, events,
    updateProject, update: updateProject, updateModule, signOut, refreshProject,
  }), [loading, user, session, workspaces, activeWorkspaceId, members,
      projects, activeProjectId, project, events, refreshProject]);

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProject() {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProject must be used inside ProjectProvider");
  return ctx;
}

/** Back-compat shim: many components read .state from the old context. */
export function useLegacyProjectState() {
  const { project } = useProject();
  return project;
}


