import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useProject } from "@/lib/project-store";
import { PageHeader, Card, SectionLabel } from "@/components/AppShell";
import { supabase } from "@/integration/supabase/client";
import { UserPlus, Loader2, Shield, Crown, User as UserIcon, Mail, Trash2 } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — ProjectPilot AI" },
      { name: "description", content: "Manage your workspace members, roles, and invitations." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { user, members, activeWorkspaceId, workspaces } = useProject();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ id: string; email: string; role: string }[]>([]);
  const ws = workspaces.find((w) => w.id === activeWorkspaceId);

  const me = members.find((m) => m.user_id === user?.id);
  const canManage = me?.role === "owner" || me?.role === "admin";

  const loadInvites = async () => {
    if (!activeWorkspaceId) return;
    const { data } = await supabase
      .from("workspace_invitations")
      .select("id, email, role")
      .eq("workspace_id", activeWorkspaceId)
      .is("accepted_at", null);
    setInvites(data ?? []);
  };
  // load on first mount and when ws changes
  useState(() => { loadInvites(); });

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !user) return;
    setBusy(true); setErr(null); setInfo(null);
    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: activeWorkspaceId, email: email.toLowerCase().trim(), role, invited_by: user.id,
    });
    if (error) setErr(error.message);
    else { setInfo(`Invited ${email}. They'll join automatically on sign-up.`); setEmail(""); await loadInvites(); }
    setBusy(false);
  };

  const revoke = async (id: string) => {
    await supabase.from("workspace_invitations").delete().eq("id", id);
    loadInvites();
  };

  return (
    <>
      <PageHeader eyebrow="Workspace" title={ws?.name ?? "Team"} />
      <div className="p-4 md:p-6 max-w-3xl mx-auto grid gap-4">
        {canManage && (
          <Card className="p-5">
            <SectionLabel>Invite a teammate</SectionLabel>
            <form onSubmit={invite} className="mt-3 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@team.com"
                  className="w-full bg-background border border-hairline rounded-lg pl-10 pr-3 py-2 text-sm outline-none focus:border-brand/50"
                />
              </div>
              <select
                value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}
                className="bg-background border border-hairline rounded-lg px-3 py-2 text-sm"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button disabled={busy} className="bg-brand text-brand-foreground rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 flex items-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                Invite
              </button>
            </form>
            {info && <p className="text-xs text-brand mt-2">{info}</p>}
            {err && <p className="text-xs text-destructive mt-2">{err}</p>}
          </Card>
        )}

        <Card className="p-5">
          <SectionLabel>Members ({members.length})</SectionLabel>
          <ul className="mt-3 divide-y divide-hairline">
            {members.map((m) => (
              <li key={m.user_id} className="py-3 flex items-center gap-3">
                <div className="size-9 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-semibold uppercase">
                  {(m.display_name || m.email || "?").slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.display_name ?? m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        </Card>

        {invites.length > 0 && (
          <Card className="p-5">
            <SectionLabel>Pending invitations</SectionLabel>
            <ul className="mt-3 divide-y divide-hairline">
              {invites.map((i) => (
                <li key={i.id} className="py-3 flex items-center gap-3">
                  <Mail className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-sm truncate">{i.email}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{i.role}</span>
                  {canManage && (
                    <button onClick={() => revoke(i.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}

function RoleBadge({ role }: { role: string }) {
  const Icon = role === "owner" ? Crown : role === "admin" ? Shield : UserIcon;
  const cls = role === "owner" ? "text-accent border-accent/30 bg-accent/10"
    : role === "admin" ? "text-brand border-brand/30 bg-brand/10"
    : "text-muted-foreground border-hairline bg-background";
  return (
    <span className={`flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${cls}`}>
      <Icon className="size-3" />{role}
    </span>
  );
}
