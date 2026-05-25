"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  authClient,
  clearStoredBearerToken,
  getStoredBearerToken,
  setStoredBearerToken,
} from "@/lib/auth-client";

type ApiResult = {
  status: number;
  body: unknown;
};

async function readApiResult(response: Response): Promise<ApiResult> {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return {
    status: response.status,
    body,
  };
}

export function AuthDemo() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [name, setName] = useState("Demo User");
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password1234");
  const [jwtToken, setJwtToken] = useState("");
  const [storedBearerToken, setStoredBearerTokenState] = useState("");
  const [message, setMessage] = useState("");
  const [protectedResult, setProtectedResult] = useState<ApiResult | null>(null);
  const [adminResult, setAdminResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    setStoredBearerTokenState(getStoredBearerToken());
  }, [session, message]);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Creating account...");

    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
    });

    if (error) {
      setMessage(error.message ?? "Sign up failed.");
      return;
    }

    await refetch();
    setMessage("Account created and signed in.");
  }

  async function handleSignIn() {
    setMessage("Signing in...");

    const { error } = await authClient.signIn.email({
      email,
      password,
    });

    if (error) {
      setMessage(error.message ?? "Sign in failed.");
      return;
    }

    await refetch();
    setMessage("Signed in.");
  }

  async function handleSignOut() {
    await authClient.signOut();
    clearStoredBearerToken();
    setJwtToken("");
    setStoredBearerTokenState("");
    setProtectedResult(null);
    setAdminResult(null);
    await refetch();
    setMessage("Signed out.");
  }

  async function fetchJwtToken() {
    setMessage("Fetching JWT...");

    const token = jwtToken || getStoredBearerToken();
    const response = await fetch("/api/auth/token", {
      credentials: "include",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    });
    const result = await readApiResult(response);

    if (response.ok && typeof result.body === "object" && result.body) {
      const nextToken = (result.body as { token?: string }).token ?? "";
      setJwtToken(nextToken);
      setStoredBearerToken(nextToken);
      setStoredBearerTokenState(nextToken);
      setMessage("JWT fetched and stored for Bearer API requests.");
      return;
    }

    setMessage(`JWT request failed with status ${result.status}.`);
  }

  async function callApi(path: "/api/protected" | "/api/admin") {
    const token = jwtToken || getStoredBearerToken();
    const response = await fetch(path, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : undefined,
    });
    const result = await readApiResult(response);

    if (path === "/api/protected") {
      setProtectedResult(result);
      return;
    }

    setAdminResult(result);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-10">
      <section className="grid gap-3 border-b border-black/10 pb-6 dark:border-white/15">
        <h1 className="text-3xl font-semibold">Better Auth JWT Demo</h1>
        <p className="max-w-3xl text-sm text-black/65 dark:text-white/65">
          Email/password authentication backed by Better Auth, Drizzle, and
          MariaDB. JWT and Bearer plugins are enabled for token API requests.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="grid gap-6">
          <form
            onSubmit={handleSignUp}
            className="grid gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15"
          >
            <h2 className="text-lg font-medium">Email/password</h2>
            <label className="grid gap-2 text-sm">
              Name
              <input
                className="h-10 rounded-md border border-black/15 bg-transparent px-3 outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Email
              <input
                className="h-10 rounded-md border border-black/15 bg-transparent px-3 outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm">
              Password
              <input
                className="h-10 rounded-md border border-black/15 bg-transparent px-3 outline-none focus:border-black dark:border-white/20 dark:focus:border-white"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="h-10 rounded-md bg-black px-4 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                type="submit"
                disabled={!email || !password}
              >
                Create account
              </button>
              <button
                className="h-10 rounded-md border border-black/15 px-4 text-sm font-medium disabled:opacity-50 dark:border-white/20"
                type="button"
                onClick={handleSignIn}
                disabled={!email || !password}
              >
                Sign in
              </button>
              <button
                className="h-10 rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/20"
                type="button"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          </form>

          <section className="grid gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15">
            <h2 className="text-lg font-medium">Token and API checks</h2>
            <div className="flex flex-wrap gap-3">
              <button
                className="h-10 rounded-md bg-black px-4 text-sm font-medium text-white dark:bg-white dark:text-black"
                type="button"
                onClick={fetchJwtToken}
              >
                Fetch JWT
              </button>
              <button
                className="h-10 rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/20"
                type="button"
                onClick={() => callApi("/api/protected")}
              >
                Protected API
              </button>
              <button
                className="h-10 rounded-md border border-black/15 px-4 text-sm font-medium dark:border-white/20"
                type="button"
                onClick={() => callApi("/api/admin")}
              >
                Admin API
              </button>
            </div>
            <CodeBlock label="JWT" value={jwtToken || "(not fetched)"} />
            <CodeBlock
              label="Protected API"
              value={JSON.stringify(protectedResult, null, 2)}
            />
            <CodeBlock
              label="Admin API"
              value={JSON.stringify(adminResult, null, 2)}
            />
          </section>
        </div>

        <aside className="grid content-start gap-4 rounded-lg border border-black/10 p-5 dark:border-white/15">
          <h2 className="text-lg font-medium">Current session</h2>
          <p className="text-sm text-black/65 dark:text-white/65">
            {isPending
              ? "Loading..."
              : session
                ? `Signed in as ${session.user.email}`
                : "Not signed in"}
          </p>
          {message ? (
            <p className="rounded-md bg-black/[.04] p-3 text-sm dark:bg-white/[.08]">
              {message}
            </p>
          ) : null}
          <CodeBlock
            label="Session"
            value={JSON.stringify(session, null, 2)}
          />
          <CodeBlock
            label="Stored Bearer token"
            value={storedBearerToken || "(not stored)"}
          />
        </aside>
      </section>
    </main>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      <pre className="max-h-60 overflow-auto rounded-md bg-black/[.04] p-3 text-xs leading-5 dark:bg-white/[.08]">
        {value}
      </pre>
    </label>
  );
}
