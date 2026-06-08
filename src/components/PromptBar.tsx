import { useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { useProject } from "@/lib/project-store";

export function PromptBar() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { project, user } = useProject();
  if (!user || !project) return null;
  if (pathname.startsWith("/auth") || pathname.startsWith("/onboarding")) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    navigate({ to: "/copilot", search: { q } as never });
    setValue("");
  };

  return (
    <div className="fixed bottom-0 left-14 md:left-16 right-0 p-3 md:p-4 bg-background/85 backdrop-blur-xl border-t border-hairline z-40">
      <form
        onSubmit={submit}
        className="max-w-3xl mx-auto flex items-center gap-2 bg-surface border border-hairline rounded-full pl-4 pr-1.5 py-1.5 focus-within:border-brand/50 focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_15%,transparent)] transition-all"
      >
        <Sparkles className="size-4 text-brand shrink-0" strokeWidth={1.75} />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="text"
          placeholder="Ask Pilot to simulate, replan, or estimate…"
          className="bg-transparent text-sm w-full outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="size-8 bg-brand text-brand-foreground rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="Send"
        >
          <ArrowRight className="size-4" strokeWidth={2.25} />
        </button>
      </form>
    </div>
  );
}
