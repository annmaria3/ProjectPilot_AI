import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card, SectionLabel } from "@/components/AppShell";
import { useProject } from "@/lib/project-store";
import { Github, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integration/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Project Settings — ProjectPilot AI" },
      { name: "description", content: "Configure project identity, team skills, and GitHub webhook integration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, update, refreshProject } = useProject();
  const [copied, setCopied] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  if (!state) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const webhookUrl = `${origin}/api/public/github-webhook/${state.id}`;

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 1500);
  };

  const rotateSecret = async () => {
    setRotating(true);
    const newSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await supabase.from("projects").update({ webhook_secret: newSecret }).eq("id", state.id);
    await refreshProject();
    setRotating(false);
  };

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Project Settings" />

      <div className="p-4 md:p-6 max-w-3xl mx-auto grid gap-4">
        <Card className="p-5 space-y-4">
          <SectionLabel>Identity</SectionLabel>
          <Field label="Project Name">
            <input value={state.name} onChange={(e) => update({ name: e.target.value })} className="input" />
          </Field>
          <Field label="Description">
            <textarea value={state.description} onChange={(e) => update({ description: e.target.value })} rows={4} className="input resize-none" />
          </Field>
          <Field label="Team Skills">
            <textarea value={state.skills} onChange={(e) => update({ skills: e.target.value })} rows={2} className="input resize-none" />
          </Field>
        </Card>

        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Github className="size-4" />
            <SectionLabel>GitHub Integration</SectionLabel>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Commits and PR activity automatically update module progress and refresh risk/delay forecasts.
          </p>

          <Field label="Repository (owner/repo)">
            <input
              value={state.githubRepo ?? ""}
              onChange={(e) => update({ githubRepo: e.target.value })}
              placeholder="acme/projectpilot"
              className="input"
            />
          </Field>

          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Webhook URL</p>
            <div className="mt-1.5 flex items-center gap-2 bg-background border border-hairline rounded-lg px-3 py-2">
              <code className="text-xs flex-1 truncate font-mono">{webhookUrl}</code>
              <button onClick={() => copy("url", webhookUrl)} className="text-muted-foreground hover:text-foreground">
                {copied === "url" ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Webhook secret</p>
              <button onClick={rotateSecret} disabled={rotating} className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1">
                {rotating ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />} rotate
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-2 bg-background border border-hairline rounded-lg px-3 py-2">
              <code className="text-xs flex-1 truncate font-mono">{state.webhookSecret}</code>
              <button onClick={() => copy("secret", state.webhookSecret)} className="text-muted-foreground hover:text-foreground">
                {copied === "secret" ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          <details className="text-xs text-muted-foreground border border-hairline rounded-lg p-3 bg-background/50">
            <summary className="cursor-pointer text-foreground font-medium">Setup instructions</summary>
            <ol className="list-decimal pl-4 mt-3 space-y-1.5 leading-relaxed">
              <li>On GitHub, open <code>Settings → Webhooks → Add webhook</code>.</li>
              <li>Paste the <strong>Webhook URL</strong> above as Payload URL.</li>
              <li>Content type: <code>application/json</code>.</li>
              <li>Paste the <strong>Webhook secret</strong> above into the Secret field.</li>
              <li>Choose individual events: <em>Pushes</em>, <em>Pull requests</em>.</li>
              <li>Save. Module progress will update automatically when commit messages or branch names match a module's name/keywords. Merged PRs mark the matching module <em>done</em>.</li>
            </ol>
          </details>
        </Card>

        <Card className="p-5">
          <SectionLabel>Tip</SectionLabel>
          <p className="text-sm text-muted-foreground mt-2">
            Edit module branch keywords directly in the database if commits aren't matching — keywords are lowercase tokens we look for in branch names and commit messages.
          </p>
        </Card>
      </div>

      <style>{`
        .input { width:100%; background:var(--background); border:1px solid var(--border); border-radius:.5rem; padding:.55rem .75rem; font-size:.875rem; color:var(--foreground); outline:none; transition:border-color .15s, box-shadow .15s; font-family: inherit; }
        .input:focus { border-color: color-mix(in oklab, var(--brand) 50%, transparent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 18%, transparent); }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
