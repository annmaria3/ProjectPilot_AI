import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Sliders, Activity, Workflow, GitBranch, Bot, Settings2, Users, ChevronsUpDown, Plus, LogOut, Loader2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PromptBar } from "./PromptBar";
import { useProject } from "@/lib/project-store";

const NAV = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/simulator", label: "Simulator", Icon: Sliders },
  { to: "/twin", label: "Digital Twin", Icon: Activity },
  { to: "/architecture", label: "Architecture", Icon: Workflow },
  { to: "/roadmap", label: "Roadmap", Icon: GitBranch },
  { to: "/copilot", label: "AI Copilot", Icon: Bot },
  { to: "/team", label: "Team", Icon: Users },
  { to: "/settings", label: "Project", Icon: Settings2 },
] as const;

const PUBLIC_PATHS = ["/auth"];
const NO_PROJECT_PATHS = ["/onboarding", "/team"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const {
    loading, user, project, projects, activeProjectId, setActiveProject,
    workspaces, activeWorkspaceId, setActiveWorkspace, signOut,
  } = useProject();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const allowsNoProject = NO_PROJECT_PATHS.some((p) => pathname.startsWith(p));

  // auth gate
  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) navigate({ to: "/auth" });
  }, [loading, user, isPublic, navigate]);

  // onboarding gate — once workspaces have loaded but there's no project
  useEffect(() => {
    if (loading || !user || isPublic || allowsNoProject) return;
    if (workspaces.length > 0 && projects.length === 0) navigate({ to: "/onboarding" });
  }, [loading, user, workspaces.length, projects.length, isPublic, allowsNoProject, navigate]);

  if (isPublic) return <>{children}</>;

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-brand/30">
      <nav className="fixed left-0 top-0 bottom-0 w-14 md:w-16 bg-surface border-r border-hairline flex flex-col items-center py-4 z-50">
        <Link to="/" className="size-9 bg-brand rounded-lg flex items-center justify-center mb-6 shadow-[0_0_20px_-4px_var(--brand)]">
          <div className="size-4 bg-background rounded-sm" />
        </Link>
        <div className="flex flex-col gap-1">
          {NAV.map(({ to, label, Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                title={label}
                className={`size-10 rounded-md flex items-center justify-center transition-all relative group ${
                  active
                    ? "bg-brand/10 text-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} />
                {active && <span className="absolute -left-[1px] top-1.5 bottom-1.5 w-[2px] bg-brand rounded-full" />}
              </Link>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1">
          <button
            onClick={signOut}
            title="Sign out"
            className="size-10 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-white/5 transition-colors"
          >
            <LogOut className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </nav>

      <main className="pl-14 md:pl-16 pb-28">
        <TopBar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspace={setActiveWorkspace}
          projects={projects}
          activeProjectId={activeProjectId}
          setActiveProject={setActiveProject}
        />
        {project || allowsNoProject ? children : (
          <div className="p-10 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <p className="text-sm text-muted-foreground">No project loaded.</p>
            <Link to="/onboarding" className="mt-3 inline-flex items-center gap-2 bg-brand text-brand-foreground px-3 py-1.5 rounded-md text-sm">
              <Plus className="size-4" /> Create project
            </Link>
          </div>
        )}
      </main>

      <PromptBar />
    </div>
  );
}

function TopBar({
  workspaces, activeWorkspaceId, setActiveWorkspace,
  projects, activeProjectId, setActiveProject,
}: {
  workspaces: { id: string; name: string }[];
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string) => void;
  projects: { id: string; name: string }[];
  activeProjectId: string | null;
  setActiveProject: (id: string) => void;
}) {
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);
  const proj = projects.find((p) => p.id === activeProjectId);
  return (
    <div className="h-11 border-b border-hairline px-3 md:px-5 flex items-center gap-2 bg-surface/60 backdrop-blur-md sticky top-0 z-30">
      <Picker
        label="Workspace"
        value={ws?.name ?? "—"}
        options={workspaces.map((w) => ({ id: w.id, label: w.name }))}
        onSelect={setActiveWorkspace}
      />
      <span className="text-muted-foreground/40">/</span>
      <Picker
        label="Project"
        value={proj?.name ?? "—"}
        options={projects.map((p) => ({ id: p.id, label: p.name }))}
        onSelect={setActiveProject}
        emptyAction={<Link to="/onboarding" className="text-xs text-brand flex items-center gap-1 px-3 py-2"><Plus className="size-3" /> New project</Link>}
      />
      <div className="ml-auto">
        <Link to="/onboarding" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <Plus className="size-3.5" /> <span className="hidden sm:inline">New project</span>
        </Link>
      </div>
    </div>
  );
}

function Picker({
  label, value, options, onSelect, emptyAction,
}: {
  label: string; value: string;
  options: { id: string; label: string }[];
  onSelect: (id: string) => void;
  emptyAction?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-medium max-w-[140px] truncate">{value}</span>
        <ChevronsUpDown className="size-3 text-muted-foreground" />
      </button>
      {open && (
        <>
          <button onClick={() => setOpen(false)} className="fixed inset-0 z-30" />
          <div className="absolute left-0 top-full mt-1 min-w-[180px] bg-surface border border-hairline rounded-lg shadow-lg overflow-hidden z-40">
            {options.length === 0 && emptyAction}
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => { onSelect(o.id); setOpen(false); }}
                className="block w-full text-left text-xs px-3 py-2 hover:bg-white/5 truncate"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow, title, action,
}: { eyebrow: string; title: string; action?: ReactNode }) {
  return (
    <header className="px-4 md:px-6 py-4 border-b border-hairline flex justify-between items-center gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        <div className="flex items-center gap-2 px-2 py-1 rounded border border-hairline bg-surface">
          <div className="size-1.5 rounded-full bg-brand animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Live</span>
        </div>
      </div>
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-surface border border-hairline rounded-xl ${className}`}>{children}</div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{children}</h3>
  );
}
