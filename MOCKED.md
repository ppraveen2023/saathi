# What's Mocked in Saathi

## /api/call (outbound voice call layer)

**Current behavior:** Returns a hardcoded realistic transcript with a 4-second delay to simulate call duration.

**What's needed to make this real:**
- Bolna AI agent configured with the call_plan as system prompt
- A real outbound phone number with IVR
- Polling logic for call completion (~30-60s typical)
- Twilio or equivalent phone infra (Bolna handles this, but requires onboarding)

**Why mocked for this version:**
Built in 24 hours for the Activate VC AI Fellows Summer 2026 application. The architecture, intent parsing, and Indic voice synthesis are all real and production-ready. The call execution layer is the only mocked component, and is cleanly isolated behind /api/call so swapping in Bolna is a single-file change.

## Everything else is real

- Sarvam STT (Hindi/English/code-mixed) — real, calling the live Sarvam API
- OpenAI GPT-4o intent parsing — real, with JSON-mode guaranteed output
- Supabase storage and DB — real, all interactions persisted
- Sarvam TTS response synthesis — real (Phase 6)
