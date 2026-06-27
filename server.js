const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

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
