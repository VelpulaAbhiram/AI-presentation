# AI Presentation Studio

AI Presentation Studio is a browser-based presentation builder for creating editable PowerPoint decks from a prompt. It can use a Claude API key for AI generation, or it can create an editable template deck without AI.

## What It Does

- Generate a deck from a prompt with Claude
- Create a deck without AI when no key is available
- Edit slide title, subtitle, kicker, bullets, notes, layout, theme, and visual prompt
- Preview the deck before export
- Create optional slide visuals from each slide prompt and theme
- Download a native editable `.pptx` PowerPoint file
- Save and load editable project JSON files separately

## Main User Flow

1. Paste a Claude API key in **API Key** and click **Save Key**.
2. Write a prompt in **Generate**.
3. Click **Generate PPT**.
4. Edit slides in the right-side editor.
5. Use **Open Preview** to review the deck.
6. Click **Download PowerPoint** to export `.pptx`.

No API key? Choose **Without AI - editable template** in Generation mode. The site will still build a full editable deck locally.

## API Key

The app has one simple API key field.

- A pasted key is saved only in the current browser with local storage.
- If the browser key is blank, the server tries `CLAUDE_API_KEY` from `.env` or hosting secrets.
- Model selection is intentionally hidden to keep the website simple for users.

Create a local `.env` file:

```bash
CLAUDE_API_KEY=your_claude_api_key_here
```

## Local Setup

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## PowerPoint Export

The **Download PowerPoint** button exports `.pptx` files. The app first uses the Node server endpoint `/api/export-pptx`. If that is unavailable, it tries the bundled browser PowerPoint exporter.

JSON is only downloaded through **Save Editable Project**. That file is for reopening and editing the project later, not for PowerPoint.

## GitHub Codespaces

1. Open the repository in GitHub.
2. Go to **Settings > Secrets and variables > Codespaces**.
3. Add `CLAUDE_API_KEY` as a Codespaces secret if you want the website to work without users pasting a key.
4. Create or reopen the Codespace.
5. Run:

```bash
git pull
npm install
npm start
```

## Project Files

- `index.html`: app shell, API key panel, Help Me panel, editor layout
- `styles.css`: responsive app styling and slide designs
- `app.js`: browser editor, preview, Claude settings, and client export fallback
- `server.js`: static server, Claude deck endpoint, visual endpoint, and PPTX export
- `vendor/pptxgen.bundle.js`: browser PPTX export fallback
- `.devcontainer/devcontainer.json`: Codespaces setup

## Notes

- Keep `.env` private. It is ignored by Git.
- The app works without AI through local editable templates.
- For a public hosted website, set `CLAUDE_API_KEY` in the host environment if you want a shared basic key.
