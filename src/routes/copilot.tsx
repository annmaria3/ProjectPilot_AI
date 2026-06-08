import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PageHeader, Card } from "@/components/AppShell";
import { useProject } from "@/lib/project-store";
import { simulate } from "@/lib/simulation";
import { askPilot } from "@/lib/ai.functions";
import { Send, Loader2, Sparkles } from "lucide-react";

const SearchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/copilot")({
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "AI Copilot — ProjectPilot AI" },
      { name: "description", content: "Chat with Pilot about your project — get advice, risks, and next-step plans." },
    ],
  }),
  component: CopilotPage,
});

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "What should I build first?",
  "Find scope to cut",
  "How do I de-risk this?",
  "Estimate cost realistically",
];

function CopilotPage() {
  const { state } = useProject();
  const search = useSearch({ from: "/copilot" });
  const ask = useServerFn(askPilot);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const initialQ = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);
    const sim = simulate(state);
    const res = await ask({
      data: {
        system: `You are Pilot, an expert project strategist embedded inside ProjectPilot AI. Keep replies tight (markdown, bullets where useful). Current project: "${state.name}" — ${state.description}. Team ${state.teamSize}, ${state.durationWeeks}w, $${state.budget}k, skill ${state.skillLevel}/10. Forecast: success ${sim.successProbability}%, risk ${sim.riskScore}, complexity ${sim.complexity}.`,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      },
    });
    const reply = "content" in res ? res.content ?? "(no reply)" : (res.error ?? "AI error");
    setMessages([...next, { role: "assistant", content: reply }]);
    setBusy(false);
  };

  useEffect(() => {
    if (search.q && initialQ.current !== search.q) {
      initialQ.current = search.q;
      send(search.q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.q]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  return (
    <>
      <PageHeader eyebrow="Conversation" title="AI Copilot" />

      <div className="p-4 md:p-6 max-w-3xl mx-auto flex flex-col gap-4">
        {messages.length === 0 && (
          <Card className="p-6 text-center">
            <Sparkles className="size-6 text-brand mx-auto mb-3" />
            <p className="text-sm">Ask Pilot anything about <span className="font-medium">{state.name}</span>.</p>
            <p className="text-xs text-muted-foreground mt-1">Pilot already knows your team, scope, budget, and forecast.</p>
            <div className="flex flex-wrap gap-2 justify-center mt-5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-hairline bg-background/60 hover:border-brand/40 hover:text-brand transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-brand/10 border border-brand/20 self-end max-w-[85%]"
                  : "bg-surface border border-hairline self-start max-w-[92%]"
              }`}
            >
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="p-3.5 rounded-xl bg-surface border border-hairline self-start flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Pilot is thinking…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="sticky bottom-24 flex items-center gap-2 bg-surface border border-hairline rounded-xl p-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="flex-1 bg-transparent outline-none text-sm px-2 placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="size-9 bg-brand text-brand-foreground rounded-lg flex items-center justify-center hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </>
  );
}
