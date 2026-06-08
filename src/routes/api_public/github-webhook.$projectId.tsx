import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api_public/github-webhook/$projectId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const projectId = params.projectId;
        const signature = request.headers.get("x-hub-signature-256") ?? "";
        const event = request.headers.get("x-github-event") ?? "";
        const delivery = request.headers.get("x-github-delivery") ?? "";
        const body = await request.text();

        const { supabaseAdmin } = await import("@/integration/supabase/client.server");

        // Fetch project + secret
        const { data: project, error: pErr } = await supabaseAdmin
          .from("projects")
          .select("id, name, webhook_secret")
          .eq("id", projectId)
          .maybeSingle();
        if (pErr || !project) {
          return new Response("Project not found", { status: 404 });
        }

        // Verify HMAC signature
        if (!signature.startsWith("sha256=")) {
          return new Response("Missing signature", { status: 401 });
        }
        const expected = "sha256=" + createHmac("sha256", project.webhook_secret).update(body).digest("hex");
        const sigBuf = Buffer.from(signature);
        const expBuf = Buffer.from(expected);
        if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
          return new Response("Invalid signature", { status: 401 });
        }

        // Load modules to match against
        const { data: modules } = await supabaseAdmin
          .from("modules")
          .select("id, slug, name, status, progress, branch_keywords")
          .eq("project_id", projectId);
        const mods = modules ?? [];

        // Match commit / PR text to a module
        const matchModule = (text: string) => {
          const t = text.toLowerCase();
          let best: typeof mods[number] | null = null;
          let bestScore = 0;
          for (const m of mods) {
            const tokens = [m.slug, m.name.toLowerCase(), ...(m.branch_keywords ?? [])];
            const score = tokens.reduce((s, k) => (k && t.includes(k.toLowerCase()) ? s + 1 : s), 0);
            if (score > bestScore) { bestScore = score; best = m; }
          }
          return bestScore > 0 ? best : null;
        };

        try {
          const payload = JSON.parse(body);

          if (event === "ping") {
            return Response.json({ ok: true, project: project.name });
          }

          if (event === "push") {
            const branch: string = (payload.ref ?? "").replace(/^refs\/heads\//, "");
            const commits: Array<{ id: string; message: string; url: string; author?: { name?: string } }> = payload.commits ?? [];
            const events: any[] = [];
            const moduleUpdates = new Map<string, { progress: number; status?: string }>();

            for (const c of commits) {
              const text = `${branch} ${c.message}`;
              const mod = matchModule(text);
              const isMerge = /^Merge /.test(c.message);
              events.push({
                project_id: projectId,
                module_id: mod?.id ?? null,
                kind: "commit",
                actor: c.author?.name ?? payload.sender?.login ?? "github",
                summary: `${mod ? `[${mod.name}] ` : ""}${c.message.split("\n")[0].slice(0, 200)}`,
                url: c.url,
                payload: { branch, sha: c.id },
              });
              if (mod && !isMerge && mod.status !== "done") {
                const cur = moduleUpdates.get(mod.id) ?? { progress: mod.progress };
                const bump = Math.min(100, cur.progress + 8);
                moduleUpdates.set(mod.id, {
                  progress: bump,
                  status: mod.status === "todo" || mod.status === "blocked" ? "in_progress" : undefined,
                });
              }
            }

            if (events.length) await supabaseAdmin.from("activity_events").insert(events);
            for (const [id, upd] of moduleUpdates) {
              const patch: any = { progress: upd.progress };
              if (upd.status) patch.status = upd.status;
              await supabaseAdmin.from("modules").update(patch).eq("id", id);
            }
            return Response.json({ ok: true, commits: commits.length, moduleUpdates: moduleUpdates.size });
          }

          if (event === "pull_request") {
            const action = payload.action;
            const pr = payload.pull_request ?? {};
            const branch: string = pr.head?.ref ?? "";
            const title: string = pr.title ?? "";
            const mod = matchModule(`${branch} ${title}`);
            let kind: "pr_opened" | "pr_merged" | "pr_closed" = "pr_opened";
            let summary = `PR ${action}: ${title}`;
            let modulePatch: any = null;

            if (action === "opened" || action === "reopened") {
              kind = "pr_opened";
            } else if (action === "closed" && pr.merged) {
              kind = "pr_merged";
              summary = `PR merged: ${title}`;
              if (mod) modulePatch = { status: "done", progress: 100 };
            } else if (action === "closed") {
              kind = "pr_closed";
            } else {
              return Response.json({ ok: true, skipped: action });
            }

            await supabaseAdmin.from("activity_events").insert({
              project_id: projectId,
              module_id: mod?.id ?? null,
              kind,
              actor: pr.user?.login ?? "github",
              summary: mod ? `[${mod.name}] ${summary}` : summary,
              url: pr.html_url,
              payload: { branch, number: pr.number },
            });
            if (modulePatch && mod) {
              await supabaseAdmin.from("modules").update(modulePatch).eq("id", mod.id);
            }
            return Response.json({ ok: true, kind });
          }

          // ignore unknown events
          return Response.json({ ok: true, ignored: event });
        } catch (e: any) {
          console.error("webhook error", e, delivery);
          return new Response("Server error", { status: 500 });
        }
      },
    },
  },
});
