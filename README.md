# Saathi

A voice agent that helps non-English-speaking Indians access government and utility services. Speak in Hindi — Saathi understands, navigates the service on your behalf, and replies in spoken Hindi.

## Live demo

https://saathi-gold.vercel.app

## What it does

1. User taps mic, speaks a request in Hindi or Hinglish ("मेरा बिजली का बिल पता करना है, account number 12345")
2. Sarvam STT transcribes the Indic speech
3. OpenAI GPT-4o parses intent (service, account number, action) and generates a call plan
4. The call layer queries the service and captures the result
5. GPT-4o summarizes the result in friendly Hindi
6. Sarvam TTS speaks the answer back to the user

## What's real vs scaffolded

See MOCKED.md for full detail. Short version:
- Indic STT (Sarvam) — real
- Intent parsing (GPT-4o) — real
- Hindi response generation (GPT-4o) — real
- Hindi TTS (Sarvam) — real
- Persistence (Supabase) — real
- Outbound call execution — scaffolded with a realistic transcript. Bolna integration is a single-file change behind /api/call.

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind
- Sarvam AI for Indic STT and TTS
- OpenAI GPT-4o for reasoning and Hindi summarization
- Supabase for DB and audio storage
- Vercel for hosting

## Run locally

1. Clone the repo
2. npm install
3. Copy .env.example to .env.local and fill in API keys (Sarvam, OpenAI, Supabase)
4. Set up the Supabase schema (see /supabase/schema.sql or the calls table definition in lib/supabase-admin.ts)
5. npm run dev

## Built for

Activate VC AI Fellows · Summer 2026 application.
Built in 24 hours, May 14-15, 2026.
