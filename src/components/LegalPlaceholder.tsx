import Link from "next/link";

export function LegalPlaceholder({ title, todo }: { title: string; todo: string }) {
  return (
    <div className="flex-1 px-6 py-24">
      <div className="max-w-xl mx-auto space-y-6">
        <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition">
          ← ENCHANTE ONE
        </Link>
        <h1 className="text-3xl font-light tracking-tight">{title}</h1>
        <p className="text-zinc-400">Content pending.</p>
        <p className="text-sm text-zinc-600 border-l border-zinc-800 pl-4">TODO (Martin): {todo}</p>
      </div>
    </div>
  );
}
