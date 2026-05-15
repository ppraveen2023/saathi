"use client";

import { useRef, useState } from "react";

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  async function startRecording() {
    setError("");
    setTranscript("");

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

      setTranscript(data.transcript || "");
      setError("");
    } catch {
      setError("Couldn't understand, please try again");
    } finally {
      setIsLoading(false);
    }
  }

  function handleMicClick() {
    if (isRecording) {
      stopRecording();
    } else if (!isLoading) {
      void startRecording();
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-center">
      <h1 className="text-6xl font-light text-white">Saathi</h1>
      <p className="mt-4 text-sm text-gray-400">Voice agent for Indian services</p>
      <button
        onClick={handleMicClick}
        disabled={isLoading}
        className={`mt-10 flex h-32 w-32 items-center justify-center rounded-full text-5xl text-black ${
          isRecording ? "animate-pulse bg-red-500" : "bg-white"
        } ${isLoading ? "opacity-60" : ""}`}
      >
        🎤
      </button>
      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      <div id="transcript-area" className="mt-8 min-h-20 px-6">
        {isRecording && <p className="text-gray-400">Recording...</p>}
        {isLoading && <p className="text-gray-400">Listening...</p>}
        {transcript && !isLoading && (
          <div>
            <p className="text-sm text-gray-400">You said:</p>
            <p className="mt-2 text-xl text-white">{transcript}</p>
          </div>
        )}
      </div>
    </main>
  );
}
