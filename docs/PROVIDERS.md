# Provider setup
Menu → **Providers & API keys**. Paste your key → **Save** → **Test connection** → (for chat providers) **Use for chat**.

| Provider | Get a key | Adapter | Test endpoint used | Default model (editable) |
|---|---|---|---|---|
| Google Gemini | aistudio.google.com | Gemini REST (`generateContent`, tools, images) | `GET /models` | gemini-2.5-flash |
| OpenAI | platform.openai.com | Chat Completions (tools, images) | `GET /models` | gpt-4o-mini |
| OpenRouter | openrouter.ai | OpenAI-compatible | `GET /auth/key` (authenticated) | openai/gpt-4o-mini |
| DeepSeek | platform.deepseek.com | OpenAI-compatible | `GET /models` | deepseek-chat |
| NVIDIA NIM | build.nvidia.com | OpenAI-compatible | `GET /models` | meta/llama-3.1-8b-instruct |
| Claude | console.anthropic.com | Anthropic Messages (tools, images) | `GET /models` | claude-haiku-5-5 |
| ElevenLabs | elevenlabs.io | Text-to-speech only | `GET /models` | eleven_multilingual_v2 |

**Verification status:** all adapters are covered by automated tests against local mock servers (request format, auth headers, tool-call round trips, error mapping). They have **not** been called against the real services (no keys or network were available). Model names are defaults from the author's knowledge and may be retired or renamed — edit the *Model* field if a provider rejects it.
Voice: Menu → Providers → *Assistant voice* — Device (default, works offline), Gemini voice, or ElevenLabs (you must paste a voice ID for Adam and Kajal). Cloud voice failures are shown and the device voice is used for that reply.
Status meanings: *Connected* (provider accepted the key) · *Invalid key* (HTTP 401/403) · *Connection error* (network/rate-limit/unexpected) · *Not configured* · *Saved – not tested*.
