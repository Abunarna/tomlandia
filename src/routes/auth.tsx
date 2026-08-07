import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAccount } from "@/lib/account.functions";
import { emailForUsername, USERNAME_RE } from "@/lib/account";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Tomlandia — Adventurer Accounts" },
      {
        name: "description",
        content:
          "Create your Tomlandia adventurer with a username and password, or sign back in to continue your journey through the Peaceful Fields.",
      },
      { property: "og:title", content: "Sign in to Tomlandia" },
      {
        property: "og:description",
        content: "Username and password only — no email needed to play Tomlandia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup-form" | "signup-warning";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/play", replace: true });
    });
  }, [navigate]);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    const { error: e } = await supabase.auth.signInWithPassword({
      email: emailForUsername(username),
      password,
    });
    setBusy(false);
    if (e) {
      setError("Wrong username or password.");
      return;
    }
    navigate({ to: "/play", replace: true });
  };

  const goToWarning = () => {
    setError(null);
    if (!USERNAME_RE.test(username.trim())) {
      setError("Username must be 3-16 letters, numbers or underscores.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setUnderstood(false);
    setMode("signup-warning");
  };

  const create = async () => {
    setError(null);
    setBusy(true);
    try {
      await createAccount({ data: { username: username.trim(), password } });
      const { error: e } = await supabase.auth.signInWithPassword({
        email: emailForUsername(username),
        password,
      });
      if (e) throw new Error("Account made, but sign in failed. Try signing in.");
      navigate({ to: "/play", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that account.");
      setMode("signup-form");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-8">
      <div className="w-full max-w-sm">
        <h1 className="text-center font-display text-4xl font-extrabold text-foreground">Tomlandia</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Welcome back, adventurer." : "Create your adventurer."}
        </p>

        <div className="mt-6 rounded-3xl border border-border/60 bg-card/90 p-5 shadow-soft backdrop-blur-md">
          {mode === "signup-warning" ? (
            <div>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                <h2 className="font-display text-lg font-bold">Read this carefully</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground">
                Your password <strong>cannot be reset or recovered</strong>. There is no email on
                your account. If you lose your password, you permanently lose this account and
                everything on it — your gold, gear, skills and progress.
              </p>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Write it down somewhere safe before you continue.
              </p>
              <div className="mt-4 rounded-2xl border border-border/60 bg-background/60 p-3 text-sm">
                <div className="text-muted-foreground">Username</div>
                <div className="font-semibold text-foreground">{username.trim()}</div>
              </div>

              <label className="mt-4 flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 size-5 accent-[hsl(var(--primary))]"
                />
                <span>I understand my password can never be reset or recovered.</span>
              </label>

              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <button
                disabled={!understood || busy}
                onClick={create}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy && <Loader2 className="size-4 animate-spin" />} Create Account
              </button>
              <button
                onClick={() => setMode("signup-form")}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm text-muted-foreground"
              >
                <ArrowLeft className="size-4" /> Back
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
              <Field
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "signup-form" && (
                <Field
                  label="Confirm password"
                  value={confirm}
                  onChange={setConfirm}
                  type="password"
                  autoComplete="new-password"
                />
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button
                disabled={busy}
                onClick={mode === "signin" ? signIn : goToWarning}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {mode === "signin" ? "Sign In" : "Continue"}
              </button>

              <button
                onClick={() => {
                  setError(null);
                  setConfirm("");
                  setMode(mode === "signin" ? "signup-form" : "signin");
                }}
                className="w-full rounded-2xl px-4 py-2 text-sm text-muted-foreground"
              >
                {mode === "signin" ? "New here? Create an account" : "I already have an account"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No email needed. Passwords cannot be recovered.
        </p>
        <div className="mt-2 text-center">
          <Link to="/" className="text-xs text-muted-foreground underline">
            Back to title
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
