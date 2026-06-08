import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, Card, SectionLabel } from "@/components/AppShell";
import { useProject } from "@/lib/project-store";

export const Route = createFileRoute("/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — ProjectPilot AI" },
      { name: "description", content: "Week-by-week project roadmap auto-derived from modules and dependencies." },
    ],
  }),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { state } = useProject();
  const weeks = useMemo(() => buildRoadmap(state.modules.length, state.durationWeeks), [state.modules.length, state.durationWeeks]);

  // assign modules to weeks (topologically: order of state.modules)
  const assignments = useMemo(() => {
    const ordered = state.modules;
    const perWeek = Math.max(1, Math.ceil(ordered.length / weeks.length));
    return weeks.map((w, i) => ({
      ...w,
      items: ordered.slice(i * perWeek, (i + 1) * perWeek),
    }));
  }, [state.modules, weeks]);

  return (
    <>
      <PageHeader eyebrow="Delivery Plan" title="Roadmap" />

      <div className="p-4 md:p-6 max-w-6xl mx-auto grid gap-4">
        <Card className="p-5 overflow-hidden">
          <SectionLabel>Timeline · {state.durationWeeks} weeks</SectionLabel>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {assignments.map((w) => (
              <div
                key={w.label}
                className="min-w-[180px] p-3 bg-background/60 border-l-2 border-brand rounded-r-lg"
              >
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{w.label}</p>
                <p className="text-xs text-foreground/80 font-medium mt-0.5">{w.phase}</p>
                <ul className="mt-3 space-y-1.5">
                  {w.items.length === 0 ? (
                    <li className="text-[11px] text-muted-foreground italic">Buffer / polish</li>
                  ) : w.items.map((m) => (
                    <li key={m.id} className="text-xs flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${
                        m.status === "done" ? "bg-brand" :
                        m.status === "blocked" ? "bg-destructive" :
                        m.status === "in_progress" ? "bg-accent" : "bg-muted-foreground/50"
                      }`} />
                      <span className="truncate">{m.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionLabel>Phases</SectionLabel>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            {PHASE_DEFS.map((p) => (
              <div key={p.name} className="p-3 rounded-lg bg-background/40 border border-hairline">
                <p className="text-xs font-medium">{p.name}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{p.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

const PHASE_DEFS = [
  { name: "Discover", desc: "Scope, research, architecture sketch." },
  { name: "Build", desc: "Core modules and integrations." },
  { name: "Integrate", desc: "End-to-end flow, AI, deployment." },
  { name: "Polish", desc: "QA, demo, documentation." },
];

function buildRoadmap(_modCount: number, weekCount: number) {
  // bucket weeks into 4 phases
  const out = [];
  for (let i = 0; i < Math.min(weekCount, 12); i++) {
    const phaseIdx = Math.min(3, Math.floor((i / Math.max(1, Math.min(weekCount, 12))) * 4));
    out.push({ label: `Week ${i + 1}`, phase: PHASE_DEFS[phaseIdx].name });
  }
  return out;
}
