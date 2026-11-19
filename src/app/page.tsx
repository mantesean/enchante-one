"use client";

import { useEffect, useRef, useState } from "react";
import { normalizeDomain } from "../lib/domain";

const checklist = [
  { title: "Describe your customer and goal", detail: "Write who you serve, the problem you solve, and one outcome you want to improve." },
  { title: "Review your homepage manually", detail: "Open your website yourself. Check whether a visitor can understand your offer and find the next step." },
  { title: "Collect evidence before deciding", detail: "Record page URLs, observation dates and customer feedback. Separate observations from assumptions before choosing one small change." },
];

type Submission = { domain: string; recordedAt: string };

export default function Home() {
  const [domain, setDomain] = useState("");
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const changingDomain = useRef(false);

  useEffect(() => {
    if (submission) resultRef.current?.focus();
    else if (changingDomain.current) {
      inputRef.current?.focus();
      changingDomain.current = false;
    }
  }, [submission]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = normalizeDomain(domain);
    if (!result.ok) {
      setError(result.error);
      inputRef.current?.focus();
      return;
    }
    setError("");
    setSubmission({ domain: result.domain, recordedAt: new Date().toISOString() });
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="max-w-xl w-full space-y-10">
        <header className="text-center">
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight mb-3">ENCHANTE ONE</h1>
          <p className="text-zinc-400 text-lg">A starting point for understanding your company.</p>
        </header>
        {!submission ? (
          <form onSubmit={handleSubmit} noValidate className="space-y-6 text-center">
            <div className="text-sm text-zinc-300 space-y-2">
              <p>Website analysis is unavailable in this pilot.</p>
              <p>No website will be fetched and no company analysis will be performed. Enter a domain to prepare a manual checklist.</p>
            </div>
            <div>
              <label htmlFor="domain" className="block text-sm font-medium">Company domain</label>
              <input ref={inputRef} id="domain" type="text" value={domain}
                onChange={(event) => { setDomain(event.target.value); setError(""); }}
                placeholder="yourcompany.com" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                maxLength={2048} required aria-invalid={Boolean(error)}
                aria-describedby={error ? "domain-help domain-error" : "domain-help"}
                className="w-full bg-transparent border-b border-zinc-600 text-2xl py-3 text-center focus:outline-none focus:border-white" />
              <p id="domain-help" className="text-sm text-zinc-400 mt-3">Public domain or HTTP(S) URL. Paths are removed. No credentials, ports, IP addresses or local names.</p>
              {error && <p id="domain-error" role="alert" className="text-sm text-red-300 mt-3">{error}</p>}
            </div>
            <button type="submit" className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-zinc-200">Prepare manual checklist</button>
            <p className="text-xs text-zinc-400">Your entry stays in this page’s memory and is cleared on reload. Domain ownership and availability are not verified.</p>
          </form>
        ) : (
          <section className="space-y-8 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8" aria-labelledby="result-title">
            <div>
              <h2 id="result-title" ref={resultRef} tabIndex={-1} className="text-2xl font-light">Your manual starting point</h2>
              <p className="text-zinc-300 mt-3">No website fetched. No company analysis performed.</p>
            </div>
            <section aria-labelledby="facts-title" className="text-sm text-zinc-300 space-y-2">
              <h3 id="facts-title" className="font-medium text-white">What we know</h3>
              <p className="break-all">Domain you entered: <strong>{submission.domain}</strong></p>
              <p>Source: your input, normalized locally. This is not a verified company fact.</p>
              <p>Recorded in this session: <time dateTime={submission.recordedAt}>{submission.recordedAt}</time></p>
              <p>Confidence: domain syntax accepted only; ownership, availability and company identity are unknown.</p>
            </section>
            <section aria-labelledby="checklist-title" className="space-y-4">
              <h3 id="checklist-title" className="font-medium">Manual next-step checklist</h3>
              <p className="text-sm text-zinc-400">General prompts, not findings or tailored recommendations.</p>
              {checklist.map((item, index) => (
                <div key={item.title} className="border-l border-zinc-600 pl-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-white" />
                    <span><span className="font-medium">{index + 1}. {item.title}</span><span className="block text-sm text-zinc-300 mt-1">{item.detail}</span></span>
                  </label>
                </div>
              ))}
              <div className="text-xs text-zinc-400 space-y-2">
                <p>Source for every step: ONE’s general onboarding checklist, shown at the session timestamp above. No website evidence was used.</p>
                <p>Confidence for every step: applicability to your company is unassessed.</p>
                <p>Limitations: these prompts do not establish problems, priorities or likely results. Verify your own evidence before acting. Checklist progress is not saved.</p>
              </div>
            </section>
            <button type="button" onClick={() => { changingDomain.current = true; setSubmission(null); }} className="w-full py-3 bg-white text-black rounded-full text-sm font-medium hover:bg-zinc-200">Change domain</button>
          </section>
        )}
      </div>
    </main>
  );
}
