# AI Presentation Studio

A browser-based MVP for generating editable presentation decks with Gemini, previewing and editing slides, generating slide visuals, and exporting native PowerPoint files.

## Features

- AI-powered prompt-to-deck generation with Gemini, Claude, Groq, or OpenAI
- Editable slide titles, subtitles, bullets, notes, layouts, and themes
- Richer presentation designs, color systems, and slide layouts
- Gemini image generation for selected slides
- Bring-your-own-key settings with basic website key or custom user key modes
- Full-deck preview modal before export
- Native `.pptx` export with editable text, shapes, metrics, notes, and generated images
- No-AI editable template mode for working without any API key
- Save/load editable project JSON backups
- Browser-side PowerPoint export fallback for static/original website usage

## Local Setup

Create a `.env` file. These values power the website's **basic key** mode:

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
```

Optional provider keys:

```bash
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-sonnet-4-5
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4.1-mini
```

Install and run:

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

Use **Generation mode > Without AI** to create and edit decks without any API key. Use **Use AI provider** when you want Gemini, Claude, Groq, or OpenAI to write the deck.

The app first tries the server PowerPoint export. If the server is unavailable, it falls back to browser-side export using the bundled `pptxgenjs` script.

## GitHub Codespaces

1. Open the repo in GitHub.
2. Go to **Settings > Secrets and variables > Codespaces**.
3. Add repository secrets for whichever basic provider you want, for example `AI_PROVIDER=gemini` and `GEMINI_API_KEY`.
4. Optionally add `GEMINI_MODEL`, `GEMINI_IMAGE_MODEL`, `CLAUDE_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY`.
5. Create a new Codespace from the `master` branch.
6. The dev container installs dependencies, forwards port `3000`, and starts the server with `npm start`.

## Notes

Keep `.env` private. It is ignored by Git and should not be committed.
