const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const pptxgen = require("pptxgenjs");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

loadEnvFile(path.join(root, ".env"));

const geminiModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const geminiImageModel = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const layoutOptions = ["cover", "split", "bullets", "metrics", "comparison", "timeline", "quote", "image"];
const themeOptions = ["aurora", "graphite", "prism", "meadow", "ember", "ocean", "royal", "sunset"];

const deckSchema = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          kicker: { type: "string" },
          layout: { type: "string", enum: layoutOptions },
          theme: { type: "string", enum: themeOptions },
          bullets: { type: "array", items: { type: "string" } },
          metrics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                value: { type: "string" },
                label: { type: "string" },
              },
            },
          },
          visualPrompt: { type: "string" },
          notes: { type: "string" },
        },
      },
    },
  },
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/generate-deck") {
      await handleGenerateDeck(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/generate-image") {
      await handleGenerateImage(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/export-pptx") {
      await handleExportPptx(req, res);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
});

server.listen(port, () => {
  console.log(`AI Presentation Studio running at http://localhost:${port}`);
});

async function handleGenerateDeck(req, res) {
  if (!isGeminiConfigured()) {
    sendJson(res, 400, { error: "GEMINI_API_KEY is not configured" });
    return;
  }

  const body = await readJson(req);
  const prompt = cleanText(body.prompt, 3000);
  const style = cleanText(body.style || "executive", 60);
  const designPack = cleanText(body.designPack || "premium", 60);
  const slideCount = clamp(Number(body.slideCount) || 7, 4, 12);
  const includeImages = Boolean(body.includeImages);

  if (!prompt) {
    sendJson(res, 400, { error: "Prompt is required" });
    return;
  }

  const instruction = [
    "You are an elite presentation strategist, designer, and editor.",
    "Create a high-quality editable presentation plan for a web app that exports to PowerPoint.",
    "Use concise titles, specific business language, and slide-ready bullets.",
    "Avoid filler, fake citations, and long paragraphs.",
    "Every slide should have a clear job in the narrative.",
    `Return exactly ${slideCount} slides.`,
    `Presentation style: ${style}.`,
    `Design pack: ${designPack}.`,
    `Image prompts: ${includeImages ? "include vivid visualPrompt values for visual slides" : "include visualPrompt only when useful"}.`,
  ].join("\n");

  const data = await callGeminiGenerate(geminiModel, {
    systemInstruction: { parts: [{ text: instruction }] },
    contents: [
      {
        role: "user",
        parts: [{ text: `Build the deck from this prompt:\n\n${prompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.85,
      responseMimeType: "application/json",
      responseSchema: deckSchema,
    },
  });

  const outputText = extractGeminiText(data);
  if (!outputText) {
    sendJson(res, 502, { error: "Gemini did not return deck JSON" });
    return;
  }

  const parsed = JSON.parse(outputText);
  const slides = normalizeGeneratedDeck(parsed, slideCount).map((slide) => ({
    ...slide,
    id: randomUUID(),
  }));

  sendJson(res, 200, { provider: "Gemini", model: geminiModel, slides });
}

async function handleGenerateImage(req, res) {
  if (!isGeminiConfigured()) {
    sendJson(res, 400, { error: "GEMINI_API_KEY is not configured" });
    return;
  }

  const body = await readJson(req);
  const prompt = cleanText(body.prompt, 1600);
  const theme = getTheme(body.theme);

  if (!prompt) {
    sendJson(res, 400, { error: "Image prompt is required" });
    return;
  }

  const data = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: geminiImageModel,
      input: [
        {
          type: "text",
          text: `${prompt}\n\nCreate a clean 16:9 presentation visual. Use the color mood ${theme.name}: ${theme.accent}, ${theme.accent2}, ${theme.bg}. Avoid tiny unreadable text.`,
        },
      ],
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "16:9",
        image_size: "1K",
      },
    }),
  });

  const result = await data.json().catch(() => ({}));
  if (!data.ok) {
    sendJson(res, data.status, { error: result.error?.message || "Gemini image generation failed" });
    return;
  }

  const image = result.output_image || findInteractionImage(result);
  if (!image?.data) {
    sendJson(res, 502, { error: "Gemini did not return an image" });
    return;
  }

  sendJson(res, 200, {
    mimeType: image.mime_type || "image/png",
    dataUrl: `data:${image.mime_type || "image/png"};base64,${image.data}`,
  });
}

async function handleExportPptx(req, res) {
  const body = await readJson(req);
  const slides = normalizeGeneratedDeck({ slides: body.slides || [] }, 12);

  if (!slides.length) {
    sendJson(res, 400, { error: "No slides to export" });
    return;
  }

  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "AI Presentation Studio";
  pptx.company = "AI Presentation Studio";
  pptx.subject = "Generated editable presentation";
  pptx.title = "AI Presentation Studio Deck";
  pptx.lang = "en-US";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  slides.forEach((deckSlide, index) => addPptxSlide(pptx, deckSlide, index));

  const buffer = await pptx.write({ outputType: "nodebuffer" });
  res.writeHead(200, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "Content-Disposition": 'attachment; filename="ai-presentation-studio-deck.pptx"',
    "Content-Length": buffer.length,
  });
  res.end(buffer);
}

async function callGeminiGenerate(model, payload) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini request failed");
  }

  return data;
}

function addPptxSlide(pptx, deckSlide, index) {
  const slide = pptx.addSlide();
  const theme = getTheme(deckSlide.theme);
  const dark = theme.mode === "dark";

  slide.background = { color: theme.bg };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: theme.bg },
    line: { color: theme.bg },
  });

  addDecor(slide, theme);

  slide.addText(deckSlide.kicker || "AI Presentation Studio", {
    x: 0.65,
    y: 0.42,
    w: 3.8,
    h: 0.25,
    fontSize: 8,
    bold: true,
    color: theme.accent,
    charSpace: 1.2,
    margin: 0,
  });

  slide.addText(deckSlide.title, {
    x: 0.65,
    y: 0.78,
    w: 7.9,
    h: 0.9,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: theme.ink,
    margin: 0,
    fit: "shrink",
  });

  slide.addText(deckSlide.subtitle, {
    x: 0.68,
    y: 1.76,
    w: 7.25,
    h: 0.55,
    fontSize: 13,
    color: theme.muted,
    margin: 0,
    fit: "shrink",
  });

  if (deckSlide.imageDataUrl && ["cover", "split", "image"].includes(deckSlide.layout)) {
    slide.addImage({ data: deckSlide.imageDataUrl, x: 8.35, y: 1.05, w: 4.35, h: 3.25 });
  }

  if (deckSlide.layout === "metrics") {
    addMetrics(slide, deckSlide, theme);
  } else if (deckSlide.layout === "comparison") {
    addComparison(slide, deckSlide, theme);
  } else if (deckSlide.layout === "timeline") {
    addTimeline(slide, deckSlide, theme);
  } else if (deckSlide.layout === "quote") {
    addQuote(slide, deckSlide, theme);
  } else if (deckSlide.layout === "image") {
    addBullets(slide, deckSlide, theme, 0.82, 4.48, 6.5, 1.3);
  } else if (deckSlide.layout === "split") {
    addBullets(slide, deckSlide, theme, 0.82, 2.85, 5.95, 2.2);
  } else if (deckSlide.layout === "cover") {
    addBullets(slide, deckSlide, theme, 0.82, 4.25, 6.85, 1.45);
  } else {
    addBullets(slide, deckSlide, theme, 0.82, 2.72, 7.35, 2.65);
  }

  slide.addText(`${index + 1}`.padStart(2, "0"), {
    x: 12.1,
    y: 6.95,
    w: 0.55,
    h: 0.24,
    fontSize: 8,
    color: dark ? "BAC4D6" : theme.muted,
    align: "right",
    margin: 0,
  });

  if (deckSlide.notes) slide.addNotes(deckSlide.notes);
}

function addDecor(slide, theme) {
  slide.addShape("arc", {
    x: 10.58,
    y: -0.25,
    w: 2.7,
    h: 2.7,
    adjustPoint: 0.18,
    fill: { color: theme.accent2, transparency: 18 },
    line: { color: theme.accent2, transparency: 100 },
    rotate: 20,
  });
  slide.addShape("rect", {
    x: 0,
    y: 7.22,
    w: 13.333,
    h: 0.28,
    fill: { color: theme.accent, transparency: 8 },
    line: { color: theme.accent, transparency: 100 },
  });
}

function addBullets(slide, deckSlide, theme, x, y, w, h) {
  const richText = deckSlide.bullets.slice(0, 5).map((bullet) => ({
    text: bullet,
    options: { bullet: { type: "bullet" }, hanging: 4, breakLine: true },
  }));

  slide.addText(richText, {
    x,
    y,
    w,
    h,
    fontSize: 14,
    color: theme.ink,
    fit: "shrink",
    paraSpaceAfterPt: 8,
    margin: 0.04,
  });
}

function addMetrics(slide, deckSlide, theme) {
  const metrics = deckSlide.metrics.length ? deckSlide.metrics : defaultMetrics();
  metrics.slice(0, 3).forEach((metric, index) => {
    const x = 0.78 + index * 3.85;
    slide.addShape("roundRect", {
      x,
      y: 3.45,
      w: 3.08,
      h: 1.52,
      rectRadius: 0.08,
      fill: { color: theme.surface },
      line: { color: theme.line },
    });
    slide.addText(metric.value, {
      x: x + 0.28,
      y: 3.72,
      w: 1.8,
      h: 0.48,
      fontSize: 28,
      bold: true,
      color: theme.accent,
      margin: 0,
      fit: "shrink",
    });
    slide.addText(metric.label, {
      x: x + 0.3,
      y: 4.3,
      w: 2.35,
      h: 0.34,
      fontSize: 10,
      color: theme.muted,
      margin: 0,
      fit: "shrink",
    });
  });
}

function addComparison(slide, deckSlide, theme) {
  const left = deckSlide.bullets[0] || "Manual workflow: slow drafts, scattered files, and inconsistent presentation polish.";
  const right = deckSlide.bullets[1] || "AI workflow: structured narrative, editable slides, and quick PowerPoint export.";
  [
    ["Before", left, 7.1, theme.ink],
    ["After", right, 9.75, theme.accent],
  ].forEach(([title, body, x, color]) => {
    slide.addShape("roundRect", {
      x,
      y: 2.62,
      w: 2.48,
      h: 2.42,
      rectRadius: 0.06,
      fill: { color: theme.surface },
      line: { color: theme.line },
    });
    slide.addText(title, { x: x + 0.25, y: 2.94, w: 1.8, h: 0.34, fontSize: 16, bold: true, color, margin: 0 });
    slide.addText(body, { x: x + 0.25, y: 3.45, w: 1.86, h: 0.95, fontSize: 10.5, color: theme.muted, fit: "shrink", margin: 0 });
  });
}

function addTimeline(slide, deckSlide, theme) {
  const items = deckSlide.bullets.length >= 4 ? deckSlide.bullets.slice(0, 4) : ["Prompt", "AI structure", "Edit live", "Export PPTX"];
  items.forEach((label, index) => {
    const x = 0.9 + index * 2.9;
    const filled = index % 2 === 0;
    slide.addShape("roundRect", {
      x,
      y: 3.45,
      w: 2.38,
      h: 1.12,
      rectRadius: 0.06,
      fill: { color: filled ? theme.accent : theme.surface },
      line: { color: filled ? theme.accent : theme.line },
    });
    slide.addText(`0${index + 1}`, { x: x + 0.22, y: 3.66, w: 0.5, h: 0.22, fontSize: 9, bold: true, color: filled ? "FFFFFF" : theme.accent, margin: 0 });
    slide.addText(label, { x: x + 0.22, y: 3.94, w: 1.72, h: 0.32, fontSize: 13, bold: true, color: filled ? "FFFFFF" : theme.ink, margin: 0, fit: "shrink" });
  });
}

function addQuote(slide, deckSlide, theme) {
  const quote = deckSlide.bullets[0] || deckSlide.subtitle;
  slide.addText(`"${quote}"`, {
    x: 1.2,
    y: 3.0,
    w: 8.4,
    h: 1.2,
    fontSize: 25,
    bold: true,
    italic: true,
    color: theme.ink,
    fit: "shrink",
    margin: 0,
  });
}

function extractGeminiText(data) {
  return (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

function findInteractionImage(result) {
  const steps = result.steps || result.output || [];
  for (const step of steps) {
    const image = step.output_image || step.image || step.inline_data;
    if (image?.data) return image;
  }
  return null;
}

function normalizeGeneratedDeck(generated, slideCount) {
  const slides = Array.isArray(generated.slides) ? generated.slides : [];
  return slides.slice(0, slideCount).map((slide, index) => {
    const layout = layoutOptions.includes(slide.layout) ? slide.layout : layoutOptions[index % layoutOptions.length];
    const theme = themeOptions.includes(slide.theme) ? slide.theme : themeOptions[index % themeOptions.length];
    const bullets = Array.isArray(slide.bullets)
      ? slide.bullets.slice(0, 5).map((bullet) => cleanText(bullet, 140)).filter(Boolean)
      : [];
    const metrics = Array.isArray(slide.metrics)
      ? slide.metrics.slice(0, 3).map((metric) => ({
          value: cleanText(metric.value, 16) || "3x",
          label: cleanText(metric.label, 48) || "Clearer presentation output",
        }))
      : [];

    return {
      id: cleanText(slide.id, 80) || randomUUID(),
      title: cleanText(slide.title, 88) || `Slide ${index + 1}`,
      subtitle: cleanText(slide.subtitle, 170) || "Generated with Gemini.",
      kicker: cleanText(slide.kicker, 42) || "AI GENERATED",
      layout,
      theme,
      bullets: bullets.length ? bullets : ["Clear narrative", "Editable structure", "Presentation-ready output"],
      metrics,
      visualPrompt: cleanText(slide.visualPrompt, 500) || `A premium presentation visual for: ${cleanText(slide.title, 90)}`,
      imageDataUrl: cleanText(slide.imageDataUrl, 2_000_000),
      notes: cleanText(slide.notes, 420) || "Use this slide to advance the presentation story.",
    };
  });
}

function defaultMetrics() {
  return [
    { value: "3x", label: "Faster draft creation" },
    { value: "92%", label: "Editable slide objects" },
    { value: "10+", label: "Design-ready layouts" },
  ];
}

function getTheme(name) {
  const themes = {
    aurora: { name: "Aurora", bg: "F7FBFC", surface: "FFFFFF", ink: "102024", muted: "5D6D75", line: "DDE8EA", accent: "00A6A6", accent2: "FFB84D" },
    graphite: { name: "Graphite", bg: "101419", surface: "1B222B", ink: "F7FAFC", muted: "BAC4D6", line: "303A46", accent: "8FE388", accent2: "79A7FF", mode: "dark" },
    prism: { name: "Prism", bg: "F7F4FF", surface: "FFFFFF", ink: "171321", muted: "6F667D", line: "E5DDF6", accent: "7C3AED", accent2: "06B6D4" },
    meadow: { name: "Meadow", bg: "F4FAF2", surface: "FFFFFF", ink: "152218", muted: "687864", line: "DDEAD9", accent: "2D8C54", accent2: "EAB308" },
    ember: { name: "Ember", bg: "FFF7F1", surface: "FFFFFF", ink: "201714", muted: "80655A", line: "F0DDD4", accent: "D9572E", accent2: "157F72" },
    ocean: { name: "Ocean", bg: "F1F7FF", surface: "FFFFFF", ink: "0F1B2D", muted: "607089", line: "D7E4F5", accent: "2563EB", accent2: "14B8A6" },
    royal: { name: "Royal", bg: "111224", surface: "1D2040", ink: "FFFFFF", muted: "C8C9E5", line: "34385F", accent: "F7C948", accent2: "9B8CFF", mode: "dark" },
    sunset: { name: "Sunset", bg: "FFF4ED", surface: "FFFFFF", ink: "241611", muted: "84675C", line: "F2D8CC", accent: "E85D75", accent2: "F6BD60" },
  };
  return themes[name] || themes.aurora;
}

function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_gemini_api_key_here"));
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(contents);
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 3_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
