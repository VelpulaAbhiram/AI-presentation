# AI Presentation Studio

A personal MVP for generating editable presentation drafts from prompts and exporting them as native PowerPoint files.

## Features

- Prompt-to-deck generation
- Editable slide titles, subtitles, bullets, notes, layouts, and themes
- Slide thumbnails with add, duplicate, and delete controls
- Clean responsive editor UI
- Browser-generated `.pptx` export with editable text and shapes
- Optional OpenAI-powered deck generation through a small local Node server

## Run

### Local fallback mode

Open `index.html` in a browser. This runs the local rule-based generator and does not need setup.

### AI mode

Create a `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5.5
```

Start the local server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

The app will use the OpenAI model for deck generation. If the API key is missing or the request fails, it falls back to the local generator.
