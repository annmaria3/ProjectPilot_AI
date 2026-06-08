import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card, SectionLabel } from "@/components/AppShell";
import { useProject } from "@/lib/project-store";
import { askPilot } from "@/lib/ai.functions";
import { Sparkles, Loader2 } from "lucide-react";
import { generateArchitecture } from "@/lib/ai.functions";

export const Route = createFileRoute("/architecture")({
  head: () => ({
    meta: [
      { title: "Architecture — ProjectPilot AI" },
      { name: "description", content: "AI-generated tech stack and architecture tailored to your project." },
    ],
  }),
  component: ArchPage,
});


interface ArchData {
  stack: { layer: string; tech: string; reason: string }[];
  flow: string;
  actors: string[];
  modules: string[];
}


function ArchPage() {
  const { state } = useProject();

  if (!state) {
  return (
    <div className="p-6">
      No active project found
    </div>
  );
}

  const ask = useServerFn(askPilot);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<ArchData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [architecture, setArchitecture] =
  useState("");

const architectureFn =
  useServerFn(generateArchitecture);

  const generate = async () => {
    setBusy(true);
    setErr(null);
    const res = await ask({
      data: {
        system:
          'You output ONLY valid JSON, no prose, no markdown fences. Schema: {"stack":[{"layer":"Frontend|Backend|Database|AI|Cloud|Hardware","tech":"name","reason":"1 sentence"}],"flow":"User -> ... single arrow chain","actors":["..."],"modules":["..."]}. Choose realistic tech that fits the project — do NOT default to React/Node/AWS unless they fit.',
        messages: [{
          role: "user",
          content: `Project: ${state.description}\nSkills: ${state.skills}\nTeam: ${state.teamSize}\nDuration: ${state.durationWeeks} weeks`,
        }],
      },
    });
    
    if ("error" in res && res.error) { setErr(res.error); setBusy(false); return; }
    const raw = (res as { content?: string }).content ?? "";
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      setData(JSON.parse(clean));
    } catch {
      setErr("Couldn't parse architecture. Try again.");
    }
    setBusy(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="System Design" title="Architecture"
        action={
          <button
            onClick={generate}
            disabled={busy}
            className="flex items-center gap-2 text-xs font-medium bg-brand text-brand-foreground px-3 py-1.5 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {busy ? "Generating" : "Generate"}
          </button>
        }
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto grid gap-4">
        {err && (
          <Card className="p-4 border-destructive/40 bg-destructive/5 text-sm text-destructive">{err}</Card>
        )}

        {!data && !busy && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Tap <span className="text-foreground">Generate</span> to draft a tailored tech stack, actor list, and data flow for "{state.name}".
            </p>
          </Card>
        )}

        {busy && (
          <Card className="p-10 flex flex-col items-center gap-3">
            <Loader2 className="size-6 animate-spin text-brand" />
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Designing system…</p>
          </Card>
        )}

        {data && (
          <>
            <Card className="p-5">
              <SectionLabel>Data Flow</SectionLabel>
              <pre className="border rounded p-4 mt-4 whitespace-pre-wrap">
User
 ↓
Frontend
 ↓
Backend API
 ↓
Database

AI Service
 ↓
Recommendation Engine
</pre>
              <p className="mt-3 font-mono text-sm text-foreground/90 leading-relaxed">{data.flow}</p>
            </Card>

            <div>
              <SectionLabel>Tech Stack</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {data.stack.map((s) => (
                  <Card key={s.layer + s.tech} className="p-4">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{s.layer}</p>
                    <p className="text-base font-semibold mt-1">{s.tech}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{s.reason}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card className="p-5">
                <SectionLabel>Actors</SectionLabel>
                <ul className="mt-3 space-y-1.5">
                  {data.actors.map((a) => (
                    <li key={a} className="text-sm flex items-center gap-2">
                      <span className="size-1 rounded-full bg-brand" />{a}
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-5">
                <SectionLabel>Modules</SectionLabel>
                <ul className="mt-3 space-y-1.5">
                  {data.modules.map((m) => (
                    <li key={m} className="text-sm flex items-center gap-2">
                      <span className="size-1 rounded-full bg-accent" />{m}
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </>
        )}
      </div>
      <div className="p-6">

  <h1 className="text-2xl font-bold">
    Architecture Generator
  </h1>

  <button
    className="bg-blue-600 text-white px-4 py-2 rounded mt-4"
    onClick={async () => {

      const res =
        await architectureFn({
          data: {
            projectName:
              state?.name || "",
          },
        }) as {
          architecture?: string;
          error?: string;
        };

      if (res.error) {
        alert(res.error);
        return;
      }

      setArchitecture(
        res.architecture || ""
      );
    }}
  >
    Generatating...
  </button>

  {architecture && (
    <div className="border rounded p-4 mt-4 whitespace-pre-wrap">
      {architecture}
    </div>
  )}

</div>
    </>
  );
}
