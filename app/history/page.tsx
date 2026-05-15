import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";

type CallRow = {
  id: string;
  created_at: string;
  user_input_text: string | null;
  result_text: string | null;
  call_transcript: string | null;
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).replace(" at ", " · ");
}

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const { data, error } = await supabaseAdmin
    .from("calls")
    .select("id, created_at, user_input_text, result_text, call_transcript")
    .order("created_at", { ascending: false })
    .limit(10);

  const calls = (data || []) as CallRow[];

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-gray-500 hover:text-white">
          ← Saathi
        </Link>
        <h1 className="mt-8 text-5xl font-light">Saathi</h1>
        <p className="mt-3 text-sm text-gray-400">Recent calls</p>
        <p className="mt-2 text-sm text-gray-500">The last 10 conversations with Saathi. Public data — this is a demo.</p>

        {error && <p className="mt-8 text-sm text-red-500">Couldn&apos;t load history.</p>}

        {!error && calls.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-500">No conversations yet. Try the demo on the home page.</p>
        )}

        <div className="mt-8 space-y-3">
          {calls.map((call) => (
            <details key={call.id} className="group rounded-lg border border-gray-800 p-4">
              <summary className="cursor-pointer list-none">
                <div className="text-xs text-gray-500">{formatTimestamp(call.created_at)}</div>
                <div className="mt-2 truncate text-base text-white">{call.user_input_text || "No transcript"}</div>
                <div className="mt-1 truncate text-sm text-gray-400">{call.result_text || "No result yet"}</div>
              </summary>
              <div className="mt-4 border-t border-gray-900 pt-4 font-mono text-sm leading-relaxed text-white/80">
                {call.call_transcript || "No call transcript yet."}
              </div>
            </details>
          ))}
        </div>
      </div>
    </main>
  );
}
