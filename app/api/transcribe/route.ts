import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const sarvamApiKey = process.env.SARVAM_API_KEY;

    if (!sarvamApiKey) {
      console.error("Sarvam API key missing");
      return NextResponse.json({ error: "Transcription service not configured" }, { status: 500 });
    }

    const incomingFormData = await request.formData();
    const audio = incomingFormData.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Audio file is required" }, { status: 400 });
    }

    if (audio.size === 0) {
      return NextResponse.json({ error: "Audio file is empty" }, { status: 400 });
    }

    const audioBuffer = await audio.arrayBuffer();
    const normalizedAudio = new Blob([audioBuffer], { type: "audio/webm" });

    const sarvamFormData = new FormData();
    sarvamFormData.append("file", normalizedAudio, "recording.webm");
    sarvamFormData.append("model", "saaras:v3");
    sarvamFormData.append("mode", "codemix");
    sarvamFormData.append("language_code", "hi-IN");

    const sarvamResponse = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": sarvamApiKey,
      },
      body: sarvamFormData,
    });

    const responseText = await sarvamResponse.text();
    let sarvamData: { transcript?: string; language_code?: string; error?: unknown } = {};

    try {
      sarvamData = JSON.parse(responseText);
    } catch {
      sarvamData = {};
    }

    if (!sarvamResponse.ok) {
      console.error("Sarvam STT failed", {
        status: sarvamResponse.status,
        body: responseText,
      });
      return NextResponse.json({ error: "Couldn't understand, please try again" }, { status: 502 });
    }

    const transcript = sarvamData.transcript?.trim();
    const language = sarvamData.language_code || "hi-IN";

    if (!transcript) {
      console.error("Sarvam STT returned empty transcript", { body: responseText });
      return NextResponse.json({ error: "Couldn't understand, please try again" }, { status: 422 });
    }

    const { data: insertedCall, error: insertError } = await supabaseAdmin
      .from("calls")
      .insert({
        user_input_text: transcript,
        language,
        status: "transcribed",
      })
      .select("id")
      .single();

    if (insertError || !insertedCall) {
      console.error("Supabase call insert failed", insertError);
      return NextResponse.json({ error: "Could not save transcript" }, { status: 500 });
    }

    return NextResponse.json({ transcript, language, call_id: insertedCall.id });
  } catch (error) {
    console.error("Transcription route failed", error);
    return NextResponse.json({ error: "Couldn't understand, please try again" }, { status: 500 });
  }
}
