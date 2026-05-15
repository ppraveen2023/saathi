import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MOCK_CALL_TRANSCRIPT = "Welcome to the Tamil Nadu Electricity Board. Press 1 for English, 2 for Tamil. [Agent selects English.] Please enter your account number followed by hash. [Agent enters 12345#.] Your account 12345 has an outstanding balance of rupees two thousand eight hundred forty seven, due on June third twenty twenty six. Press 1 to pay now or 2 to disconnect. [Agent ends call.]";

export async function POST(request: Request) {
  try {
    let body: { call_id?: unknown; call_plan?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const callId = typeof body.call_id === "string" ? body.call_id.trim() : "";

    if (!callId || !Array.isArray(body.call_plan)) {
      return NextResponse.json({ error: "call_id and call_plan are required" }, { status: 400 });
    }

    await new Promise((r) => setTimeout(r, 4000));

    const { error: updateError } = await supabaseAdmin
      .from("calls")
      .update({
        call_transcript: MOCK_CALL_TRANSCRIPT,
        status: "completed",
      })
      .eq("id", callId);

    if (updateError) {
      console.error("Supabase call transcript update failed", updateError);
      return NextResponse.json({ error: "Could not save call transcript" }, { status: 500 });
    }

    return NextResponse.json({
      transcript: MOCK_CALL_TRANSCRIPT,
      status: "completed",
      is_mocked: true,
    });
  } catch (error) {
    console.error("Mock call route failed", error);
    return NextResponse.json({ error: "Could not complete simulated call" }, { status: 500 });
  }
}
