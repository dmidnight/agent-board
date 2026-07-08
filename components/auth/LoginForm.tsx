"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, LogIn, MailCheck, UserPlus } from "lucide-react";
import styles from "./LoginForm.module.css";

type Mode = "login" | "register";
type TeamMode = "create" | "join";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [teamMode, setTeamMode] = useState<TeamMode>("create");
  const [inviteToken, setInviteToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (token) {
      window.setTimeout(() => {
        setMode("register");
        setTeamMode("join");
        setInviteToken(token);
      }, 0);
    }
  }, []);

  function submit(formData: FormData) {
    setError("");

    const payload = {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      name: String(formData.get("name") ?? ""),
      teamName: String(formData.get("teamName") ?? ""),
      inviteToken: String(formData.get("inviteToken") ?? "")
    };

    startTransition(async () => {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(data?.error ?? "Something went wrong.");
        return;
      }

      router.replace("/");
      router.refresh();
    });
  }

  const isRegistering = mode === "register";

  return (
    <form action={submit} className={styles.form}>
      <div className={styles.segmented} aria-label="Authentication mode">
        <button
          aria-pressed={mode === "login"}
          type="button"
          onClick={() => setMode("login")}
        >
          Sign in
        </button>
        <button
          aria-pressed={mode === "register"}
          type="button"
          onClick={() => setMode("register")}
        >
          Create account
        </button>
      </div>

      <div className={styles.heading}>
        <h2>{isRegistering ? "Create your board" : "Welcome back"}</h2>
        <p>
          {isRegistering
            ? "Use email and password to start a team workspace."
            : "Sign in to continue moving work across the board."}
        </p>
      </div>

      {isRegistering ? (
        <>
          <label className={styles.field}>
            <span>Name</span>
            <input name="name" autoComplete="name" placeholder="Ada Lovelace" />
          </label>

          <div className={styles.teamBlock}>
            <div className={styles.segmented} aria-label="Team setup mode">
              <button
                aria-pressed={teamMode === "create"}
                type="button"
                onClick={() => setTeamMode("create")}
              >
                <Building2 size={15} />
                New team
              </button>
              <button
                aria-pressed={teamMode === "join"}
                type="button"
                onClick={() => setTeamMode("join")}
              >
                <MailCheck size={15} />
                Use invite
              </button>
            </div>

            {teamMode === "create" ? (
              <label className={styles.field}>
                <span>Team name</span>
                <input
                  name="teamName"
                  autoComplete="organization"
                  placeholder="Acme Research"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
            ) : (
              <label className={styles.field}>
                <span>Invitation token</span>
                <input
                  name="inviteToken"
                  value={inviteToken}
                  onChange={(event) => setInviteToken(event.target.value)}
                  placeholder="Paste invitation token"
                  minLength={16}
                  maxLength={160}
                  required
                />
              </label>
            )}
          </div>
        </>
      ) : null}

      <label className={styles.field}>
        <span>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className={styles.field}>
        <span>Password</span>
        <div className={styles.password}>
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isRegistering ? "new-password" : "current-password"}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />}
        {isPending
          ? "Working..."
          : isRegistering
            ? "Create account"
            : "Sign in"}
      </button>
    </form>
  );
}
