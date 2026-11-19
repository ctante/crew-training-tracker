"use client";

import { useState, useTransition } from "react";
import { signInAction } from "@/app/actions";
import { fieldClass, primaryButton } from "@/components/ui";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-6 grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
          const password = String(new FormData(event.currentTarget).get("password") || "");
          const login = String(new FormData(event.currentTarget).get("login") || "");
          setError("");
          startTransition(async () => {
            const result = await signInAction({ login, password, nextPath });
          if (result?.error) setError(result.error);
        });
      }}
    >
      <label className="text-sm font-semibold" htmlFor="login">
        Username
        <input
          id="login"
          name="login"
          type="text"
          autoComplete="username"
          className={`${fieldClass} mt-1`}
        />
      </label>
      <p className="-mt-2 text-sm text-ink/60">Leave this blank for the admin password or a restaurant password.</p>
      <label className="text-sm font-semibold" htmlFor="password">
        Password
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`${fieldClass} mt-1`}
        />
      </label>
      {error ? (
        <p className="text-sm text-brick-dark" role="alert">
          {error}
        </p>
      ) : null}
      <button className={primaryButton} type="submit" disabled={pending}>
        {pending ? "Checking" : "Sign in"}
      </button>
    </form>
  );
}
