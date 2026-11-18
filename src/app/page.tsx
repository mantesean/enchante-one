"use client";

import { useState } from "react";

export default function Home() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    setLoading(true);
    setTimeout(() => {
      setProfile({
        name: domain.replace(/\..*$/, "").replace(/[-_]/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        domain: domain,
        description: "Company identified from public web presence. Further analysis available in Founding Access.",
        insights: [
          { title: "Web conversion signal", detail: "Public homepage analysis suggests opportunity to clarify primary call-to-action.", source: "Public page structure" },
          { title: "Content freshness", detail: "Limited recent public content detected. Opportunity for consistent authority building.", source: "Public signals" },
          { title: "Competitive context", detail: "Peers in the space show stronger digital presence in key channels.", source: "Public comparison" }
        ]
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      <div className="max-w-xl w-full text-center space-y-10">
        <div>
          <h1 className="text-5xl font-light tracking-tight mb-3">ENCHANTE ONE</h1>
          <p className="text-zinc-400 text-lg">The intelligent operating layer for your company.</p>
        </div>

        {!profile ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="yourcompany.com"
              className="w-full bg-transparent border-b border-zinc-700 text-2xl py-3 text-center focus:outline-none focus:border-white transition"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-white text-black rounded-full text-sm font-medium tracking-wide hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "See your company"}
            </button>
          </form>
        ) : (
          <div className="text-left space-y-8 bg-zinc-950 border border-zinc-800 rounded-2xl p-8">
            <div>
              <h2 className="text-2xl font-light">{profile.name}</h2>
              <p className="text-zinc-500 text-sm mt-1">{profile.domain}</p>
              <p className="mt-4 text-zinc-300 leading-relaxed">{profile.description}</p>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs uppercase tracking-widest text-zinc-500">Opportunities</h3>
              {profile.insights.map((ins: any, i: number) => (
                <div key={i} className="border-l border-zinc-700 pl-4">
                  <p className="font-medium">{ins.title}</p>
                  <p className="text-sm text-zinc-400 mt-1">{ins.detail}</p>
                  <p className="text-xs text-zinc-600 mt-1">Source: {ins.source}</p>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-zinc-800">
              <p className="text-sm text-zinc-400 mb-4">Unlock the full intelligence, recommended next action, and founding company status.</p>
              <button className="w-full py-3 bg-white text-black rounded-full text-sm font-medium">
                Founding Access · 4 900 CZK
              </button>
              <p className="text-xs text-zinc-600 mt-3 text-center">Limited to 50 founding companies. Includes 12 months of updates and lifetime founding rate.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
