# FOAI Project 2 (Chat + Image via APIs)

This project is a simple frontend that:
- Sends chat messages to the OpenRouter `chat/completions` endpoint
- Generates images via the Hugging Face inference API

## Setup
1. Create a file named `.env` in the project root.
2. Copy values from `.env.example` into `.env`.

### Required environment variables
- `VITE_OPENROUTER_API_KEY`
- `VITE_HF_TOKEN`

Optional:
- `VITE_OPENROUTER_MODEL`
- `VITE_HF_IMAGE_MODEL`
- `VITE_CHAT_SYSTEM_PROMPT`

## Run locally
```bash
npm install
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## API details (what the frontend calls)
### Text (OpenRouter)
- `POST https://openrouter.ai/api/v1/chat/completions`
- JSON body includes:
  - `model`
  - `messages` (system + conversation history + the latest user message)

### Image (Hugging Face)
- `POST https://api-inference.huggingface.co/models/<model>`
- JSON body includes:
  - `inputs: "<prompt>"`

## Notes / Common issues
- If the page shows an error like “Missing environment variables”, update your `.env`.
- If requests fail with CORS/network issues, try using the exact endpoint listed in the lab and ensure your provider/model supports browser calls.

# foai-project-2
