"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Intent = {
  service_type: string;
  account_number: string | null;
  action: string;
  user_intent_summary?: string;
  call_plan?: string[];
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [callTranscript, setCallTranscript] = useState("");
  const [responseText, setResponseText] = useState("");
  const [responseAudioUrl, setResponseAudioUrl] = useState("");
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [error, setError] = useState("");
  const [currentCallId, setCurrentCallId] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const statusLabel = responseText
    ? ""
    : isRecording
      ? "Listening..."
      : isLoading
        ? "Understanding your words..."
        : isPlanning
          ? "Figuring out what you need..."
          : isCalling
            ? "Calling on your behalf..."
            : isResponding
              ? "Almost done..."
              : "";

  useEffect(() => {
    if (callTranscript && currentCallId && intent && !responseText && !isResponding) {
      void createSpokenResponse(currentCallId, callTranscript, intent.user_intent_summary || transcript);
    }
  }, [callTranscript, currentCallId, intent, responseText, isResponding, transcript]);

  async function startRecording() {
    setError("");
    setTranscript("");
    setIntent(null);
    setCallTranscript("");
    setResponseText("");
    setResponseAudioUrl("");
    setAutoplayBlocked(false);
    setShowUnsupported(false);
    setCurrentCallId("");
    audioRef.current = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        const durationMs = Date.now() - startedAtRef.current;
        const audioBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });

        if (durationMs < 1000 || audioBlob.size === 0) {
          setError("Hold the button and speak");
          setIsLoading(false);
          return;
        }

        await transcribeAudio(audioBlob);
      };

      recorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);
    } catch {
      setError("Please allow microphone access");
      setIsRecording(false);
      setIsLoading(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state === "inactive") {
      return;
    }

    setIsRecording(false);
    setIsLoading(true);
    recorderRef.current.stop();
  }

  async function transcribeAudio(audioBlob: Blob) {
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Transcription failed");
      }

      const nextTranscript = data.transcript || "";
      const nextCallId = data.call_id || "";

      setTranscript(nextTranscript);
      setCurrentCallId(nextCallId);
      setError("");

      if (nextTranscript && nextCallId) {
        await planIntent(nextTranscript, nextCallId);
      }
    } catch {
      setError("Couldn't understand, please try again");
    } finally {
      setIsLoading(false);
    }
  }

  async function planIntent(nextTranscript: string, nextCallId: string) {
    setIsPlanning(true);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: nextTranscript, call_id: nextCallId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Intent parsing failed");
      }

      const nextIntent = data.intent as Intent;
      setIntent(nextIntent);
      setIsPlanning(false);

      if (nextIntent.service_type === "electricity") {
        await simulateCall(nextCallId, data.call_plan || nextIntent.call_plan || []);
      } else {
        setShowUnsupported(true);
      }
    } catch {
      setError("Couldn't parse that, try again");
      setIsPlanning(false);
    }
  }

  async function simulateCall(nextCallId: string, callPlan: string[]) {
    setIsCalling(true);

    try {
      const response = await fetch("/api/call", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ call_id: nextCallId, call_plan: callPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Call simulation failed");
      }

      setCallTranscript(data.transcript || "");
    } catch {
      setError("Couldn't complete the simulated call, try again");
    } finally {
      setIsCalling(false);
    }
  }

  async function createSpokenResponse(nextCallId: string, nextCallTranscript: string, originalUserIntent: string) {
    setIsResponding(true);

    try {
      const response = await fetch("/api/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          call_id: nextCallId,
          call_transcript: nextCallTranscript,
          original_user_intent: originalUserIntent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Response synthesis failed");
      }

      setResponseText(data.text || "");
      setResponseAudioUrl(data.audio_url || "");

      const audio = new Audio(data.audio_url);
      audioRef.current = audio;
      setAutoplayBlocked(false);

      try {
        await audio.play();
      } catch {
        setAutoplayBlocked(true);
      }
    } catch {
      setError("Couldn't create the spoken response, try again");
    } finally {
      setIsResponding(false);
    }
  }

  function playResponseAudio() {
    if (!audioRef.current && responseAudioUrl) {
      audioRef.current = new Audio(responseAudioUrl);
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      void audioRef.current.play();
    }
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else if (!isLoading && !isPlanning && !isCalling && !isResponding) {
      void startRecording();
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-black px-4 py-10 pb-28 text-center text-white sm:px-6">
      <Link href="/history" className="absolute right-4 top-4 text-sm text-gray-500 hover:text-white sm:right-6 sm:top-6">
        History →
      </Link>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center">
        <h1 className="text-5xl font-light sm:text-6xl">Saathi</h1>
        <p className="mt-4 text-sm text-gray-400">Voice agent for Indian services</p>

        {responseText && (
          <div className="mx-auto mb-8 mt-4 w-full max-w-2xl rounded-2xl border border-green-500/20 bg-green-500/5 p-6 shadow-lg shadow-green-500/10">
            <p className="break-words text-xl font-light leading-relaxed text-white sm:text-2xl">{responseText}</p>
            <div className="mt-4 flex justify-center">
              <button
                onClick={playResponseAudio}
                className="rounded-full border border-gray-700 px-3 py-1 text-sm text-gray-400 hover:text-white"
              >
                {autoplayBlocked ? "▶ Tap to play" : "▶ Play again"}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={handleMicClick}
          disabled={isLoading || isPlanning || isCalling || isResponding}
          className={`mt-10 flex h-32 min-h-32 w-32 min-w-32 items-center justify-center rounded-full text-5xl text-black ${
            isRecording ? "animate-pulse bg-red-500" : "bg-white"
          } ${isLoading || isPlanning || isCalling || isResponding ? "opacity-60" : ""}`}
        >
          🎤
        </button>

        <div className="mt-4 min-h-5">
          {statusLabel && (
            <p className="text-sm italic text-gray-500 opacity-100 transition-opacity duration-300">{statusLabel}</p>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <div id="transcript-area" className="mt-6 min-h-20 w-full px-0 sm:px-6">
          {transcript && !isLoading && (
            <div>
              <p className="text-sm text-gray-400">You said:</p>
              <p className="mt-2 break-words text-base text-white sm:text-xl">{transcript}</p>
              {intent && !isPlanning && (
                <div className="mt-4 rounded-lg border border-gray-800 p-4 text-left text-base text-white sm:text-lg">
                  <p>Service: {intent.service_type}</p>
                  <p className="mt-2">Account: {intent.account_number || "Not found"}</p>
                  <p className="mt-2">Action: {intent.action}</p>
                </div>
              )}
              {showUnsupported && (
                <div className="mt-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200">
                  This service isn&apos;t supported in this demo yet — we built the electricity flow as proof of concept.
                </div>
              )}
              {callTranscript && !isCalling && (
                <div className="relative mt-4 rounded-lg border border-gray-800 p-4 text-left">
                  <span className="absolute right-4 top-4 rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-500">
                    Simulated
                  </span>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Call transcript</p>
                  <p className="mt-4 break-words pr-24 font-mono text-sm text-white/80">{callTranscript}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="absolute bottom-0 w-full border-t border-gray-900 px-4 pb-5 pt-4 text-center text-xs text-gray-600">
        Built with Sarvam AI · OpenAI · Bolna · Supabase · Next.js
      </footer>
    </main>
  );
}
