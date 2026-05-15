import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are an intent parser for an Indian government/utility services voice agent. The user has spoken in Hindi, English, or Hinglish (code-mixed). Given the transcript, extract structured intent.

The account number may be spoken as:

English digits: "twelve three four five"

Hindi digits: "बारह तीन चार पाँच" (baarah teen chaar paanch)

Devanagari numerals: १२३४५

Arabic numerals: 12345

Mixed: "one two तीन four पाँच" Always normalize to Arabic numerals (e.g., "12345").

Output ONLY valid JSON matching this schema: { "service_type": "electricity" | "pf" | "aadhaar" | "gas" | "water" | "other", "account_number": string or null, "action": "check_balance" | "check_status" | "dispute" | "update" | "other", "language": "hi-IN" | "en-IN" | "ta-IN" | "mixed", "user_intent_summary": string (one Hindi sentence describing what they want), "call_plan": [array of strings, each describing one step the voice agent should take when calling the service] }

If service_type is not "electricity", still parse it but set call_plan to ["Service not yet supported in this demo"]`;

type ParsedIntent = {
  service_type: "electricity" | "pf" | "aadhaar" | "gas" | "water" | "other";
  account_number: string | null;
  action: "check_balance" | "check_status" | "dispute" | "update" | "other";
  language: "hi-IN" | "en-IN" | "ta-IN" | "mixed";
  user_intent_summary: string;
  call_plan: string[];
};

function isValidIntent(value: unknown): value is ParsedIntent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const intent = value as Partial<ParsedIntent>;
  return (
    typeof intent.service_type === "string" &&
    (typeof intent.account_number === "string" || intent.account_number === null) &&
    typeof intent.action === "string" &&
    typeof intent.language === "string" &&
    typeof intent.user_intent_summary === "string" &&
    Array.isArray(intent.call_plan) &&
    intent.call_plan.every((step) => typeof step === "string")
  );
}

export async function POST(request: Request) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error("OpenAI API key missing");
      return NextResponse.json({ error: "Intent parser not configured" }, { status: 500 });
    }

    let body: { transcript?: unknown; call_id?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";
    const callId = typeof body.call_id === "string" ? body.call_id.trim() : "";

    if (!transcript || !callId) {
      return NextResponse.json({ error: "transcript and call_id are required" }, { status: 400 });
    }

    const model = "gpt-4o";
    console.log("OpenAI intent parser model", model);

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
      temperature: 0,
    });

    const rawContent = completion.choices[0]?.message?.content || "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      console.error("OpenAI returned invalid JSON", rawContent);
      return NextResponse.json({ error: "Couldn't parse that, try again" }, { status: 502 });
    }

    if (!isValidIntent(parsed)) {
      console.error("OpenAI returned wrong schema", rawContent);
      return NextResponse.json({ error: "Couldn't parse that, try again" }, { status: 502 });
    }

    const intent: ParsedIntent = parsed.service_type === "electricity"
      ? parsed
      : { ...parsed, call_plan: ["Service not yet supported in this demo"] };

    const { error: updateError } = await supabaseAdmin
      .from("calls")
      .update({ intent })
      .eq("id", callId);

    if (updateError) {
      console.error("Supabase intent update failed", updateError);
      return NextResponse.json({ error: "Could not save intent" }, { status: 500 });
    }

    return NextResponse.json({ intent, call_plan: intent.call_plan });
  } catch (error) {
    console.error("Intent planning route failed", error);
    return NextResponse.json({ error: "Couldn't parse that, try again" }, { status: 500 });
  }
}
