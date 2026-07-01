# AI Presentation Studio

A browser-based MVP for generating editable presentation decks with Gemini, previewing and editing slides, generating slide visuals, and exporting native PowerPoint files.

## Features

- Gemini-powered prompt-to-deck generation
- Editable slide titles, subtitles, bullets, notes, layouts, and themes
- Richer presentation designs, color systems, and slide layouts
- Gemini image generation for selected slides
- Full-deck preview modal before export
- Native `.pptx` export with editable text, shapes, metrics, notes, and generated images

## Local Setup

Create a `.env` file:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
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

## GitHub Codespaces

1. Open the repo in GitHub.
2. Go to **Settings > Secrets and variables > Codespaces**.
3. Add a repository secret named `GEMINI_API_KEY` with your Gemini key.
4. Optionally add `GEMINI_MODEL` and `GEMINI_IMAGE_MODEL`.
5. Create a new Codespace from the `master` branch.
6. The dev container installs dependencies, forwards port `3000`, and starts the server with `npm start`.

## Notes

Keep `.env` private. It is ignored by Git and should not be committed.
