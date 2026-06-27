const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const pptxgen = require("pptxgenjs");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

loadEnvFile(path.join(root, ".env"));

const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const deckSchema = {
  type: "object",
  additionalProperties: false,
  required: ["slides"],
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "subtitle", "layout", "theme", "bullets", "notes"],
        properties: {
          title: { type: "string" },
          subtitle: { type: "string" },
          layout: { type: "string", enum: ["hero", "bullets", "metrics", "comparison", "timeline"] },
          theme: { type: "string", enum: ["aurora", "mono", "signal", "ember"] },
          bullets: {
            type: "array",
            items: { type: "string" },
          },
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
    sendJson(res, 500, { error: "Unexpected server error" });
  }
});

server.listen(port, () => {
  console.log(`AI Presentation Studio running at http://localhost:${port}`);
});

async function handleGenerateDeck(req, res) {
  if (!process.env.GROQ_API_KEY || process.env.GROQ_API_KEY.includes("your_groq_api_key_here")) {
    sendJson(res, 400, { error: "GROQ_API_KEY is not configured" });
    return;
  }

  const body = await readJson(req);
  const prompt = cleanText(body.prompt, 2500);
  const style = cleanText(body.style || "executive", 40);
  const slideCount = clamp(Number(body.slideCount) || 7, 4, 10);

  if (!prompt) {
    sendJson(res, 400, { error: "Prompt is required" });
    return;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a senior presentation strategist and slide designer. Generate concise, premium, editable presentation content. Avoid generic filler. Every slide should have a clear business purpose and a strong narrative flow.",
        },
        {
          role: "user",
          content: `Create a ${slideCount}-slide ${style} presentation deck from this prompt:\n\n${prompt}\n\nReturn exactly ${slideCount} slides. Use a mix of layouts. Keep bullets short enough for slides. Speaker notes should help the presenter explain the slide.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "presentation_deck",
          strict: true,
          schema: deckSchema,
        },
      },
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || "OpenAI request failed";
    sendJson(res, response.status, { error: message });
    return;
  }

  const outputText = data.choices?.[0]?.message?.content || "";
  if (!outputText) {
    sendJson(res, 502, { error: "Groq did not return deck JSON" });
    return;
  }

  const generated = normalizeGeneratedDeck(JSON.parse(outputText), slideCount);
  sendJson(res, 200, {
    slides: generated.map((slide) => ({
      ...slide,
      id: randomUUID(),
    })),
  });
}

async function handleExportPptx(req, res) {
  const body = await readJson(req);
  const slides = normalizeGeneratedDeck({ slides: body.slides || [] }, 10);

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

function addPptxSlide(pptx, deckSlide, index) {
  const slide = pptx.addSlide();
  const theme = getTheme(deckSlide.theme);
  slide.background = { color: theme.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: theme.bg },
    line: { color: theme.bg },
  });

  slide.addText(deckSlide.title, {
    x: 0.65,
    y: 0.58,
    w: 7.8,
    h: 0.72,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: theme.ink,
    margin: 0,
    breakLine: false,
    fit: "shrink",
  });

  slide.addText(deckSlide.subtitle, {
    x: 0.65,
    y: 1.35,
    w: 7.1,
    h: 0.55,
    fontSize: 14,
    color: theme.muted,
    margin: 0,
    fit: "shrink",
  });

  const layout = deckSlide.layout || "bullets";
  if (layout === "metrics") {
    addMetrics(slide, theme);
  } else if (layout === "comparison") {
    addComparison(slide, theme);
  } else if (layout === "timeline") {
    addTimeline(slide, theme);
  } else if (layout === "hero") {
    addHero(slide, deckSlide, theme);
  } else {
    addBullets(slide, deckSlide, theme, 0.85, 2.55, 6.9, 2.4);
  }

  slide.addText(`${index + 1}`, {
    x: 12.25,
    y: 6.95,
    w: 0.38,
    h: 0.24,
    fontSize: 8,
    color: theme.muted,
    align: "right",
    margin: 0,
  });

  if (deckSlide.notes) {
    slide.addNotes(deckSlide.notes);
  }
}

function addHero(slide, deckSlide, theme) {
  slide.addShape("arc", {
    x: 9.65,
    y: 0.7,
    w: 2.45,
    h: 2.45,
    adjustPoint: 0.18,
    fill: { color: theme.accent2, transparency: 18 },
    line: { color: theme.accent2, transparency: 100 },
    rotate: 24,
  });
  addBullets(slide, deckSlide, theme, 0.85, 4.35, 7.0, 1.5);
}

function addBullets(slide, deckSlide, theme, x, y, w, h) {
  const richText = deckSlide.bullets.slice(0, 4).map((bullet) => ({
    text: bullet,
    options: {
      bullet: { type: "bullet" },
      hanging: 4,
      breakLine: true,
    },
  }));

  slide.addText(richText, {
    x,
    y,
    w,
    h,
    fontSize: 15,
    color: theme.ink,
    fit: "shrink",
    valign: "mid",
    paraSpaceAfterPt: 8,
    margin: 0.04,
  });
}

function addMetrics(slide, theme) {
  [
    ["3x", "Faster draft creation"],
    ["92%", "Editable slide objects"],
    ["10", "Export-ready layouts"],
  ].forEach(([stat, label], index) => {
    const x = 0.78 + index * 3.8;
    slide.addShape("roundRect", {
      x,
      y: 3.55,
      w: 3.05,
      h: 1.35,
      rectRadius: 0.08,
      fill: { color: theme.surface },
      line: { color: "DDE5EC" },
    });
    slide.addText(stat, {
      x: x + 0.28,
      y: 3.78,
      w: 1.45,
      h: 0.4,
      fontSize: 25,
      bold: true,
      color: theme.accent,
      margin: 0,
    });
    slide.addText(label, {
      x: x + 0.3,
      y: 4.28,
      w: 2.3,
      h: 0.3,
      fontSize: 10,
      color: theme.muted,
      margin: 0,
    });
  });
}

function addComparison(slide, theme) {
  [
    ["Before", "Manual outline, copy, layout, and export cleanup.", 7.25],
    ["After", "Prompt-driven draft with editable PowerPoint output.", 9.85],
  ].forEach(([title, body, x], index) => {
    slide.addShape("roundRect", {
      x,
      y: 2.5,
      w: 2.35,
      h: 2.45,
      rectRadius: 0.06,
      fill: { color: theme.surface },
      line: { color: "DDE5EC" },
    });
    slide.addText(title, {
      x: x + 0.25,
      y: 2.85,
      w: 1.8,
      h: 0.35,
      fontSize: 16,
      bold: true,
      color: index ? theme.accent : theme.ink,
      margin: 0,
    });
    slide.addText(body, {
      x: x + 0.25,
      y: 3.35,
      w: 1.75,
      h: 0.86,
      fontSize: 11,
      color: theme.muted,
      fit: "shrink",
      margin: 0,
    });
  });
}

function addTimeline(slide, theme) {
  ["Prompt", "Outline", "Edit", "Export"].forEach((label, index) => {
    const x = 0.95 + index * 2.85;
    const filled = index % 2 === 0;
    slide.addShape("roundRect", {
      x,
      y: 3.4,
      w: 2.35,
      h: 1.1,
      rectRadius: 0.06,
      fill: { color: filled ? theme.accent : theme.surface },
      line: { color: filled ? theme.accent : "DDE5EC" },
    });
    slide.addText(`0${index + 1}`, {
      x: x + 0.24,
      y: 3.62,
      w: 0.55,
      h: 0.25,
      fontSize: 11,
      bold: true,
      color: filled ? "FFFFFF" : theme.accent,
      margin: 0,
    });
    slide.addText(label, {
      x: x + 0.24,
      y: 3.9,
      w: 1.6,
      h: 0.28,
      fontSize: 15,
      bold: true,
      color: filled ? "FFFFFF" : theme.ink,
      margin: 0,
    });
  });
}

function getTheme(name) {
  const themes = {
    aurora: { bg: "F8FBFD", surface: "FFFFFF", ink: "131820", muted: "667085", accent: "1B8A8F", accent2: "F2B544" },
    mono: { bg: "F4F4F1", surface: "FFFFFF", ink: "171717", muted: "6B6B64", accent: "2F5D50", accent2: "B6A16B" },
    signal: { bg: "F3F7FF", surface: "FFFFFF", ink: "101828", muted: "64748B", accent: "315CFF", accent2: "10A37F" },
    ember: { bg: "FFF8F3", surface: "FFFFFF", ink: "201A17", muted: "765E54", accent: "C95532", accent2: "2D8C73" },
  };
  return themes[name] || themes.aurora;
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
      if (raw.length > 12_000) {
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

function normalizeGeneratedDeck(generated, slideCount) {
  const layouts = ["hero", "bullets", "metrics", "comparison", "timeline"];
  const themes = ["aurora", "mono", "signal", "ember"];
  const slides = Array.isArray(generated.slides) ? generated.slides : [];

  return slides.slice(0, slideCount).map((slide, index) => ({
    title: cleanText(slide.title, 80) || `Slide ${index + 1}`,
    subtitle: cleanText(slide.subtitle, 150) || "Generated with Groq.",
    layout: layouts.includes(slide.layout) ? slide.layout : layouts[index % layouts.length],
    theme: themes.includes(slide.theme) ? slide.theme : themes[index % themes.length],
    bullets: Array.isArray(slide.bullets)
      ? slide.bullets.slice(0, 4).map((bullet) => cleanText(bullet, 130)).filter(Boolean)
      : ["Key point", "Supporting detail", "Next action"],
    notes: cleanText(slide.notes, 350) || "Use this slide to advance the presentation story.",
  }));
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
    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}
