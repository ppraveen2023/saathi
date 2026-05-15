"use client";

import { useRef, useState } from "react";

type Intent = {
  service_type: string;
  account_number: string | null;
  action: string;
  call_plan?: string[];
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [callTranscript, setCallTranscript] = useState("");
  const [showUnsupported, setShowUnsupported] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  async function startRecording() {
    setError("");
    setTranscript("");
    setIntent(null);
    setCallTranscript("");
    setShowUnsupported(false);

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

      if (nextIntent.service_type === "electricity") {
        await simulateCall(nextCallId, data.call_plan || nextIntent.call_plan || []);
      } else {
        setShowUnsupported(true);
      }
    } catch {
      setError("Couldn't parse that, try again");
    } finally {
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

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else if (!isLoading && !isPlanning && !isCalling) {
      void startRecording();
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-center">
      <h1 className="text-6xl font-light text-white">Saathi</h1>
      <p className="mt-4 text-sm text-gray-400">Voice agent for Indian services</p>
      <button
        onClick={handleMicClick}
        disabled={isLoading || isPlanning || isCalling}
        className={`mt-10 flex h-32 w-32 items-center justify-center rounded-full text-5xl text-black ${
          isRecording ? "animate-pulse bg-red-500" : "bg-white"
        } ${isLoading || isPlanning || isCalling ? "opacity-60" : ""}`}
      >
        🎤
      </button>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <div id="transcript-area" className="mt-8 min-h-20 px-6">
        {isRecording && <p className="text-gray-400">Recording...</p>}
        {isLoading && <p className="text-gray-400">Sending audio to Sarvam and waiting for transcript...</p>}
        {transcript && !isLoading && (
          <div>
            <p className="text-sm text-gray-400">You said:</p>
            <p className="mt-2 text-xl text-white">{transcript}</p>
            {isPlanning && <p className="mt-4 text-sm italic text-gray-400">Understanding...</p>}
            {intent && !isPlanning && (
              <div className="mt-4 rounded-lg border border-gray-800 p-4 text-left text-white">
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
            {isCalling && (
              <p className="mt-4 text-sm italic text-gray-400">
                Calling on your behalf
                <span className="ml-1 inline-block animate-bounce">.</span>
                <span className="inline-block animate-bounce [animation-delay:150ms]">.</span>
                <span className="inline-block animate-bounce [animation-delay:300ms]">.</span>
              </p>
            )}
            {callTranscript && !isCalling && (
              <div className="relative mt-4 rounded-lg border border-gray-800 p-4 text-left">
                <span className="absolute right-4 top-4 rounded-full border border-gray-700 px-2 py-0.5 text-xs text-gray-500">
                  Simulated
                </span>
                <p className="text-xs uppercase tracking-wide text-gray-400">Call transcript</p>
                <p className="mt-4 pr-24 font-mono text-sm text-white/80">{callTranscript}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
