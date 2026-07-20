"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Incorrect email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
      <div>
        <label className="text-sm text-text-muted block mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-bg border border-border px-3 py-2 outline-none focus:border-accent"
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="text-sm text-text-muted block mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg bg-bg border border-border px-3 py-2 outline-none focus:border-accent"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-negative text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent text-bg font-medium py-2.5 hover:opacity-90 transition disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-sm text-text-muted text-center">
        No account?{" "}
        <Link href="/register" className="text-accent underline underline-offset-2">
          Create one
        </Link>
      </p>
      <p className="text-xs text-text-muted text-center pt-2 border-t border-border">
        Signing in requires a connection the first time. After that, the app works fully offline.
      </p>
    </form>
  );
}
