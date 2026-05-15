"use client";

import { useRef, useState } from "react";

type Intent = {
  service_type: string;
  account_number: string | null;
  action: string;
};

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  async function startRecording() {
    setError("");
    setTranscript("");
    setIntent(null);

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

      setIntent(data.intent);
    } catch {
      setError("Couldn't parse that, try again");
    } finally {
      setIsPlanning(false);
    }
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else if (!isLoading && !isPlanning) {
      void startRecording();
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-center">
      <h1 className="text-6xl font-light text-white">Saathi</h1>
      <p className="mt-4 text-sm text-gray-400">Voice agent for Indian services</p>
      <button
        onClick={handleMicClick}
        disabled={isLoading || isPlanning}
        className={`mt-10 flex h-32 w-32 items-center justify-center rounded-full text-5xl text-black ${
          isRecording ? "animate-pulse bg-red-500" : "bg-white"
        } ${isLoading || isPlanning ? "opacity-60" : ""}`}
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
          </div>
        )}
      </div>
    </main>
  );
}
