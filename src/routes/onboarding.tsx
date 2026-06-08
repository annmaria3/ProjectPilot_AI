import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { brainstormProject, type BrainstormResult } from "@/lib/ai.functions";
import { useProject } from "@/lib/project-store";
import { supabase } from "@/integration/supabase/client";
import { Sparkles, Loader2, ArrowRight, ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "New project — ProjectPilot AI" },
      { name: "description", content: "Spin up a new AI-guided project: brainstorm the idea, set team parameters, get a tailored module plan." },
    ],
  }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, activeWorkspaceId, refreshProject, setActiveProject, workspaces } = useProject();
  const brainstorm = useServerFn(brainstormProject);

  const [step, setStep] = useState(1);
  const [idea, setIdea] = useState("");
  const [skills, setSkills] = useState("");
  const [teamSize, setTeamSize] = useState(4);
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [skillLevel, setSkillLevel] = useState(6);
  const [budget, setBudget] = useState(15);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<BrainstormResult | null>(null);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const runBrainstorm = async () => {
    setBusy(true); setErr(null);
    const res = await brainstorm({ data: { idea, teamSize, durationWeeks, skillLevel, skills } });
    if (res.error || !res.result) setErr(res.error ?? "AI error");
    else { setPlan(res.result); setStep(4); }
    setBusy(false);
  };

  const createLovableAuthroject = async () => {
    if (!plan || !user || !activeWorkspaceId) return;
    setBusy(true); setErr(null);
    try {
      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: activeWorkspaceId,
          name: plan.name,
          description: plan.description,
          skills,
          team_size: teamSize,
          duration_weeks: durationWeeks,
          budget,
          skill_level: skillLevel,
          created_by: user.id,
        })
        .select()
        .single();
        console.log("PROJECT:", proj);
        console.log("ERROR:", error);
      if (error) throw error;
      const modulesPayload = plan.modules.map((m, i) => ({
        project_id: proj.id,
        slug: m.slug,
        name: m.name,
        depends_on: m.dependsOn,
        branch_keywords: m.branchKeywords,
        position: i,
        status: "todo" as const,
        progress: 0,
      }));
      const { error: mErr } = await supabase.from("modules").insert(modulesPayload);
      if (mErr) throw mErr;
      await supabase.from("activity_events").insert({
        project_id: proj.id,
        kind: "ai",
        actor: "Pilot",
        summary: `Project bootstrapped: ${plan.modules.length} modules generated from idea.`,
      });
      console.log("PROJECT ID:", proj.id);

await setActiveProject(proj.id);

setTimeout(() => {
  navigate({
    to: "/project/$projectId",
    params: {
      projectId: proj.id,
    },
  });
}, 500);
    } catch (e: any) {
      setErr(e.message ?? "Failed to create project");
    } finally { setBusy(false); }
  };

  if (!workspaces.length) {
    return <div className="p-6 text-sm text-muted-foreground">Loading workspace…</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 border-b border-hairline flex justify-between items-center">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">New Mission</p>
          <h1 className="text-lg font-semibold tracking-tight">Spin up a project</h1>
        </div>
        <Stepper step={step} />
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 md:p-10">
          {step === 1 && (
            <Section title="What are you building?" sub="Describe the idea in plain language. Pilot will refine, scope, and break it into modules.">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={6}
                placeholder="e.g. An AI assistant that helps CS students plan their final-year project — feasibility check, tech recommendations, weekly milestones, and a digital twin to track progress…"
                className="w-full mt-3 bg-background border border-hairline rounded-xl p-4 text-sm leading-relaxed outline-none focus:border-brand/50 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)] transition-all resize-none"
              />
              <Field label="Team skills (optional)">
                <input
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, Python, basic ML"
                  className="input"
                />
              </Field>
              <Footer onNext={next} nextDisabled={idea.trim().length < 10} />
            </Section>
          )}

          {step === 2 && (
            <Section title="Your team" sub="These shape the success forecast and the module-load distribution.">
              <Slider label="Team size" suffix="people" min={1} max={20} value={teamSize} onChange={setTeamSize} />
              <Slider label="Duration" suffix="weeks" min={2} max={52} value={durationWeeks} onChange={setDurationWeeks} />
              <Slider label="Avg. skill level" suffix="/ 10" min={1} max={10} value={skillLevel} onChange={setSkillLevel} />
              <Slider label="Budget" suffix="$k" min={0} max={200} value={budget} onChange={setBudget} />
              <Footer onPrev={prev} onNext={next} />
            </Section>
          )}

          {step === 3 && (
            <Section title="Generate the plan" sub="Pilot will draft a project name, refined description, modules with dependencies, recommended stack, and risks.">
              <div className="mt-4 bg-background border border-hairline rounded-xl p-4 space-y-2 text-sm">
                <Row k="Idea" v={idea} />
                <Row k="Team" v={`${teamSize} people · skill ${skillLevel}/10`} />
                <Row k="Duration" v={`${durationWeeks} weeks`} />
                <Row k="Skills" v={skills || "—"} />
              </div>
              {err && <p className="text-xs text-destructive mt-3">{err}</p>}
              <Footer onPrev={prev}>
                <button
                  onClick={runBrainstorm}
                  disabled={busy}
                  className="btn-brand"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {busy ? "Pilot is thinking…" : "Brainstorm with Pilot"}
                </button>
              </Footer>
            </Section>
          )}

          {step === 4 && plan && (
            <Section title={plan.name} sub={plan.description}>
              <div className="grid gap-3 mt-4">
                <Card label="Modules">
                  <ul className="space-y-1.5 mt-2">
                    {plan.modules.map((m, i) => (
                      <li key={m.slug} className="flex items-start gap-2 text-sm">
                        <span className="text-[10px] font-mono text-muted-foreground mt-1 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          {m.dependsOn.length > 0 && (
                            <p className="text-[11px] text-muted-foreground font-mono">depends: {m.dependsOn.join(", ")}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card label="Stack">
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {plan.recommendedStack.map((s) => <Chip key={s}>{s}</Chip>)}
                    </div>
                  </Card>
                  <Card label="Success factors">
                    <ul className="text-sm mt-2 space-y-1">{plan.successFactors.map((f) => <li key={f} className="flex gap-2"><Check className="size-3.5 text-brand mt-0.5" />{f}</li>)}</ul>
                  </Card>
                </div>
                <Card label="Risks">
                  <ul className="text-sm mt-2 space-y-1">{plan.risks.map((r) => <li key={r} className="flex gap-2"><span className="text-accent">!</span>{r}</li>)}</ul>
                </Card>
              </div>
              {err && <p className="text-xs text-destructive mt-3">{err}</p>}
              <Footer onPrev={() => setStep(3)}>
                <button onClick={createLovableAuthroject} disabled={busy} className="btn-brand">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  Launch project
                </button>
              </Footer>
            </Section>
          )}
        </div>
      </div>

      <style>{`
        .input { width:100%; background:var(--background); border:1px solid var(--border); border-radius:.6rem; padding:.55rem .8rem; font-size:.875rem; color:var(--foreground); outline:none; transition:border-color .15s, box-shadow .15s; }
        .input:focus { border-color: color-mix(in oklab, var(--brand) 50%, transparent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent); }
        .btn-brand { display:inline-flex; align-items:center; gap:.5rem; background:var(--brand); color:var(--brand-foreground); padding:.55rem 1rem; border-radius:.6rem; font-size:.875rem; font-weight:500; transition:opacity .15s; }
        .btn-brand:hover { opacity:.9; }
        .btn-brand:disabled { opacity:.5; }
      `}</style>
    </div>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1.5">{sub}</p>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-4">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Footer({ onPrev, onNext, nextDisabled, children }: {
  onPrev?: () => void; onNext?: () => void; nextDisabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between mt-8 pt-5 border-t border-hairline">
      {onPrev ? (
        <button onClick={onPrev} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back
        </button>
      ) : <span />}
      {children ?? (
        <button onClick={onNext} disabled={nextDisabled} className="btn-brand">
          Continue <ArrowRight className="size-4" />
        </button>
      )}
    </div>
  );
}
function Slider({ label, value, onChange, min, max, suffix }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; suffix: string }) {
  return (
    <div className="mt-5">
      <div className="flex justify-between text-[11px] font-mono uppercase tracking-wider">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground tabular-nums">{value} {suffix}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="slider w-full mt-2" />
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-16 shrink-0 mt-0.5">{k}</span>
      <span className="flex-1">{v}</span>
    </div>
  );
}
function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-hairline rounded-xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-mono px-2 py-1 rounded bg-background border border-hairline">{children}</span>;
}
function Stepper({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`h-1 w-7 rounded-full transition-all ${i <= step ? "bg-brand" : "bg-white/10"}`} />
      ))}
    </div>
  );
}
