import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, Card, SectionLabel } from "@/components/AppShell";
import { useProject, type ModuleStatus } from "@/lib/project-store";
import { simulate, criticalPath } from "@/lib/simulation";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/twin")({
  head: () => ({
    meta: [
      { title: "Digital Twin — ProjectPilot AI" },
      { name: "description", content: "Live virtual representation of project health, module status, and critical path." },
    ],
  }),
  component: TwinPage,
});

const STATUS_OPTIONS: ModuleStatus[] = ["todo", "in_progress", "blocked", "done"];

function TwinPage() {
  const { state, updateModule } = useProject();
  const sim = useMemo(() => simulate(state), [state]);
  const path = useMemo(() => criticalPath(state.modules), [state.modules]);
  const pathIds = new Set(path);

  const counts = state.modules.reduce(
    (acc: Record<ModuleStatus, number>, m) => ((acc[m.status] = (acc[m.status] ?? 0) + 1), acc),
    {} as Record<ModuleStatus, number>
  );

  return (
    <>
      <PageHeader eyebrow="Live Twin" title="Digital Twin" />

      <div className="p-4 md:p-6 max-w-5xl mx-auto grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Health" value={`${sim.health}`} tone="good" />
          <Stat label="Predicted Ship" value={sim.predictedCompletion} tone="neutral" mono />
          <Stat label="Delay" value={`${sim.predictedDelayDays}d`} tone={sim.predictedDelayDays > 0 ? "warn" : "good"} />
          <Stat label="Critical" value={state.modules.find((m) => m.id === sim.criticalModuleId)?.name ?? "—"} tone="warn" />
        </div>

        <Card className="p-5">
          <div className="flex justify-between items-center mb-4">
            <SectionLabel>Module Twin</SectionLabel>
            <div className="flex gap-3 text-[10px] font-mono uppercase tracking-wider">
              <LegendDot tone="good" /> done · {counts.done ?? 0}
              <LegendDot tone="warn" /> wip · {counts.in_progress ?? 0}
              <LegendDot tone="bad" /> blocked · {counts.blocked ?? 0}
            </div>
          </div>

          <div className="grid gap-2">
            {state.modules.map((m) => {
              const isCritical = pathIds.has(m.id) && m.status !== "done";
              return (
                <div
                  key={m.id}
                  className={`p-3 rounded-lg border bg-background/40 transition-colors ${
                    isCritical ? "border-accent/40 bg-accent/[0.04]" : "border-hairline"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <StatusIcon status={m.status} />
                    <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                    {isCritical && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-accent">
                        Critical
                      </span>
                    )}
                    <span className="text-xs font-mono tabular-nums text-muted-foreground w-10 text-right">
                      {m.progress}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full ${
                        m.status === "done" ? "bg-brand" : m.status === "blocked" ? "bg-destructive" : "bg-accent"
                      }`}
                      style={{ width: `${m.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0} max={100} value={m.progress}
                      onChange={(e) => updateModule(m.id, { progress: Number(e.target.value) })}
                      className="slider flex-1"
                    />
                    <select
                      value={m.status}
                      onChange={(e) => updateModule(m.id, { status: e.target.value as ModuleStatus })}
                      className="bg-background border border-hairline text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded text-foreground"
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Critical Path</SectionLabel>
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            {path.map((id, i) => {
              const m = state.modules.find((x) => x.id === id)!;
              return (
                <div key={id} className="flex items-center gap-1">
                  <span className={`px-2 py-1 rounded text-xs font-mono border ${
                    m.status === "done" ? "border-brand/40 bg-brand/10 text-brand" :
                    m.status === "blocked" ? "border-destructive/40 bg-destructive/10 text-destructive" :
                    "border-accent/40 bg-accent/10 text-accent"
                  }`}>{m.name}</span>
                  {i < path.length - 1 && <span className="text-muted-foreground">→</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function StatusIcon({ status }: { status: ModuleStatus }) {
  if (status === "done") return <CheckCircle2 className="size-4 text-brand" strokeWidth={1.75} />;
  if (status === "blocked") return <AlertTriangle className="size-4 text-destructive" strokeWidth={1.75} />;
  if (status === "in_progress") return <Loader2 className="size-4 text-accent" strokeWidth={1.75} />;
  return <Circle className="size-4 text-muted-foreground" strokeWidth={1.75} />;
}

function LegendDot({ tone }: { tone: "good" | "warn" | "bad" }) {
  const c = tone === "good" ? "bg-brand" : tone === "warn" ? "bg-accent" : "bg-destructive";
  return <span className={`size-1.5 rounded-full inline-block ${c}`} />;
}

function Stat({ label, value, tone, mono }: { label: string; value: string; tone: "good" | "warn" | "bad" | "neutral"; mono?: boolean }) {
  const c =
    tone === "good" ? "text-brand" :
    tone === "warn" ? "text-accent" :
    tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card className="p-3.5">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg ${mono ? "font-mono" : "font-semibold"} mt-1 ${c} truncate`}>{value}</p>
    </Card>
  );
}
