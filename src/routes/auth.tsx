import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integration/supabase/client";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ProjectPilot AI" },
      { name: "description", content: "Sign in to ProjectPilot AI to plan, simulate, and ship your team's project." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        setInfo("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setErr(e.message ?? "Authentication failed");
    } finally { setBusy(false); }
  };

  const google = async () => {
  const { error } =
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

  if (error) {
    setErr(error.message);
  }
};

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 opacity-40" style={{
        backgroundImage:
          "radial-gradient(circle at 20% 10%, color-mix(in oklab, var(--brand) 25%, transparent), transparent 45%), radial-gradient(circle at 90% 80%, color-mix(in oklab, var(--accent) 18%, transparent), transparent 50%)",
      }} />
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="size-8 rounded-lg bg-brand flex items-center justify-center shadow-[0_0_24px_-4px_var(--brand)]">
            <Sparkles className="size-4 text-brand-foreground" strokeWidth={2} />
          </div>
          <span className="font-semibold tracking-tight">ProjectPilot AI</span>
        </div>

        <div className="bg-surface border border-hairline rounded-2xl p-7">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "signin" ? "Welcome back" : "Get started"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">
            {mode === "signin" ? "Sign in to ProjectPilot" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Simulate, plan, and run team projects with an AI co-pilot.
          </p>

          {/* <button
            onClick={google}
            disabled={busy}
            type="button"
            className="mt-6 w-full flex items-center justify-center gap-2.5 border border-hairline bg-background hover:bg-white/[0.03] rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <GoogleMark /> Continue with Google
          </button>*/}

          <div className="my-5 flex items-center gap-3 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="flex-1 h-px bg-hairline" /> or email <span className="flex-1 h-px bg-hairline" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <Input label="Name" value={name} onChange={setName} placeholder="Ada Lovelace" />
            )}
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@team.com" required />
            <Input label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />

            {err && <p className="text-xs text-destructive">{err}</p>}
            {info && <p className="text-xs text-brand">{info}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-brand text-brand-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-5">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setErr(null); setInfo(null); }}
              className="text-brand hover:underline"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder, required, minLength }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required={required} minLength={minLength}
        className="mt-1.5 w-full bg-background border border-hairline rounded-lg px-3 py-2 text-sm outline-none focus:border-brand/50 focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_18%,transparent)] transition-all"
      />
    </label>
  );
}

function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C33.6 5.6 29 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C33.6 5.6 29 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5 0 9.5-1.9 12.9-5l-6-5c-2 1.4-4.4 2.2-6.9 2.2-5.3 0-9.7-3.4-11.3-8L6.1 33C9.4 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5C40.8 35.4 44 30.2 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
