"use client";

import { useState, useEffect, useRef } from "react";

import type { AnalyzeResult } from "@/lib/analyze";
import type { InsightStatus } from "@/lib/insights";

type ApiError = { ok: false; domain?: string; error: { code: string; message: string } };
type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; result: Extract<AnalyzeResult, { ok: true }> }
  | { kind: "unreachable"; domain: string; message: string }
  | { kind: "invalid"; message: string };

const STATUS_STYLE: Record<InsightStatus, { label: string; dot: string }> = {
  issue: { label: "Issue", dot: "bg-amber-400" },
  good: { label: "Good", dot: "bg-emerald-400" },
  info: { label: "Note", dot: "bg-zinc-500" },
};

function formatFetchedAt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [domain, setDomain] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (state.kind === "invalid" || state.kind === "idle") inputRef.current?.focus();
    if (state.kind === "done") document.getElementById("observations-title")?.focus();
  }, [state.kind]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) { setState({ kind: "invalid", message: "Enter a public company domain." }); return; }
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = (await res.json()) as AnalyzeResult | ApiError;
      if (data.ok) setState({ kind: "done", result: data });
      else if (data.domain && data.error.code !== "invalid" && data.error.code !== "rate_limited")
        setState({ kind: "unreachable", domain: data.domain, message: data.error.message });
      else setState({ kind: "invalid", message: data.error.message });
    } catch {
      setState({ kind: "invalid", message: "Something went wrong on our side. Please try again." });
    }
  };

  const reset = () => setState({ kind: "idle" });
  const loading = state.kind === "loading";

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pt-24 pb-8">
      <div className="max-w-xl w-full text-center space-y-10">
        <div>
          <h1 className="text-5xl font-light tracking-tight mb-3">ENCHANTE ONE</h1>
          <p className="text-zinc-400 text-lg">Review public website evidence.</p>
        </div>

        {state.kind !== "done" && state.kind !== "unreachable" && (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate aria-busy={loading}>
            <p className="text-sm text-zinc-300">This preview checks static website signals only when retrieval is enabled. It does not perform a company audit or run AI agents.</p>
            <label htmlFor="domain" className="sr-only">
              Company domain
            </label>
            <input
              ref={inputRef}
              id="domain"
              type="text"
              inputMode="url"
              autoComplete="url"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="yourcompany.com"
              aria-invalid={state.kind === "invalid"}
              aria-describedby={state.kind === "invalid" ? "domain-error" : undefined}
              className="w-full bg-transparent border-b border-zinc-700 text-2xl py-3 text-center focus:outline-none focus:border-white transition"
              required
            />
            {state.kind === "invalid" && (
              <p id="domain-error" role="alert" className="text-sm text-zinc-400">
                {state.message}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium tracking-wide hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "Reading the homepage…" : "Check website evidence"}
            </button>
          </form>
        )}

        {state.kind === "unreachable" && (
          <div className="text-left space-y-6 bg-zinc-950 border border-zinc-800 rounded-2xl p-8" role="status">
            <p className="text-zinc-300 leading-relaxed">
              We couldn&rsquo;t reach <span className="text-white">{state.domain}</span>: {state.message}. No insights were
              generated.
            </p>
            <button onClick={reset} className="text-sm text-zinc-400 hover:text-white transition">
              ← Try another domain
            </button>
          </div>
        )}

        {state.kind === "done" && <Result result={state.result} onReset={reset} />}
      </div>
    </div>
  );
}

function Result({ result, onReset }: { result: Extract<AnalyzeResult, { ok: true }>; onReset: () => void }) {
  const { profile, insights, fetch: meta } = result;
  return (
    <div className="text-left space-y-8 bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
      <div>
        <h2 id="observations-title" tabIndex={-1} className="text-2xl font-light">{profile.name}</h2>
        <p className="text-zinc-500 text-sm mt-1 break-all">{profile.finalUrl}</p>
        <p className="mt-4 text-zinc-300 leading-relaxed">{profile.description}</p>
        <p className="text-xs text-zinc-600 mt-3">
          Read from the public homepage on {formatFetchedAt(profile.fetchedAt)} · {meta.ms} ms
          {meta.usedHttpFallback && " · HTTPS unavailable, fetched over HTTP"}
        </p>
      </div>

      <div className="space-y-5">
        <h3 className="text-xs uppercase tracking-widest text-zinc-500">What we observed</h3>
        <ul className="space-y-5">
          {insights.map((ins) => {
            const s = STATUS_STYLE[ins.status];
            return (
              <li key={ins.id} className="border-l border-zinc-800 pl-4">
                <p className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
                  <span className="sr-only">{s.label}:</span>
                  <span className="font-medium">{ins.title}</span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600" aria-hidden="true">
                    {s.label}
                  </span>
                </p>
                <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{ins.detail}</p>
                <p className="text-sm text-zinc-400">{ins.limitation} Observed: {formatFetchedAt(ins.observedAt)}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  <span className="text-zinc-600">Evidence </span>
                  <code className="font-mono text-zinc-400 break-all">{ins.evidence}</code>
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-zinc-600">
          Source:{" "}
          <a href={profile.finalUrl} rel="noopener noreferrer nofollow" target="_blank" className="underline decoration-zinc-700 hover:text-zinc-300">
            {profile.finalUrl}
          </a>
          . Based only on this single page response.
        </p>
      </div>

      <section className="pt-4 border-t border-zinc-800 space-y-3">
        <h3 className="font-medium">Choose one observation to verify</h3>
        <p className="text-sm text-zinc-300">Open the source page, check the observation in a browser, and record what you found before deciding on a change. These are static HTML signals, not a company audit.</p>
      </section>

      <button onClick={onReset} className="text-sm text-zinc-500 hover:text-white transition">
        ← Analyze another domain
      </button>
    </div>
  );
}
