import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

async function ensureResponsesBucket() {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

  if (listError) {
    throw listError;
  }

  const exists = buckets.some((bucket) => bucket.name === "responses");

  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket("responses", {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ["audio/wav", "audio/mpeg", "audio/mp3"],
    });

    if (createError) {
      throw createError;
    }
  }
}

async function synthesizeWithSarvam(text: string) {
  const apiKey = process.env.SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error("Sarvam API key missing");
  }

  const subscriptionKey = apiKey;

  async function requestTts(speaker: string) {
    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": subscriptionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        target_language_code: "hi-IN",
        speaker,
        model: "bulbul:v2",
        output_audio_codec: "wav",
        enable_preprocessing: true,
      }),
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(raw || `Sarvam TTS failed with ${response.status}`);
    }

    let parsed: { audios?: string[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Sarvam TTS returned invalid JSON: ${raw}`);
    }

    const base64Audio = parsed.audios?.[0];

    if (!base64Audio) {
      throw new Error(`Sarvam TTS returned no audio: ${raw}`);
    }

    return Buffer.from(base64Audio, "base64");
  }

  return requestTts("anushka");
}

export async function POST(request: Request) {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      console.error("OpenAI API key missing");
      return NextResponse.json({ error: "Responder not configured" }, { status: 500 });
    }

    let body: { call_id?: unknown; call_transcript?: unknown; original_user_intent?: unknown };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 500 });
    }

    const callId = typeof body.call_id === "string" ? body.call_id.trim() : "";
    const callTranscript = typeof body.call_transcript === "string" ? body.call_transcript.trim() : "";
    const originalUserIntent = typeof body.original_user_intent === "string" ? body.original_user_intent.trim() : "";

    if (!callId || !callTranscript || !originalUserIntent) {
      return NextResponse.json({ error: "call_id, call_transcript, and original_user_intent are required" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `Summarize this Indian service call result in ONE friendly, conversational sentence in Hindi (Devanagari script). Address the user warmly. Include the key number/info they wanted. Do not add greetings or sign-offs, just the answer. Keep it under 150 characters.\n\nUser originally asked: ${originalUserIntent}\nCall transcript: ${callTranscript}`,
        },
      ],
      temperature: 0.2,
    });

    const text = completion.choices[0]?.message?.content?.trim();

    if (!text) {
      console.error("OpenAI returned empty Hindi summary", completion);
      return NextResponse.json({ error: "Could not summarize call result" }, { status: 500 });
    }

    const audioBuffer = await synthesizeWithSarvam(text);

    await ensureResponsesBucket();

    const filePath = `${callId}.wav`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("responses")
      .upload(filePath, audioBuffer, {
        contentType: "audio/wav",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase response audio upload failed", uploadError);
      return NextResponse.json({ error: "Could not save response audio" }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from("responses").getPublicUrl(filePath);
    const audioUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("calls")
      .update({
        result_text: text,
        result_audio_url: audioUrl,
      })
      .eq("id", callId);

    if (updateError) {
      console.error("Supabase response update failed", updateError);
      return NextResponse.json({ error: "Could not save response" }, { status: 500 });
    }

    return NextResponse.json({ text, audio_url: audioUrl });
  } catch (error) {
    console.error("Respond route failed", error);
    return NextResponse.json({ error: "Could not create spoken response" }, { status: 500 });
  }
}
