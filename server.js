const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

loadEnvFile(path.join(root, ".env"));

const model = process.env.OPENAI_MODEL || "gpt-5.5";

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
      minItems: 4,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "subtitle", "layout", "theme", "bullets", "notes"],
        properties: {
          title: { type: "string", minLength: 3, maxLength: 80 },
          subtitle: { type: "string", minLength: 3, maxLength: 150 },
          layout: { type: "string", enum: ["hero", "bullets", "metrics", "comparison", "timeline"] },
          theme: { type: "string", enum: ["aurora", "mono", "signal", "ember"] },
          bullets: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string", minLength: 4, maxLength: 130 },
          },
          notes: { type: "string", minLength: 8, maxLength: 350 },
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
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 400, { error: "OPENAI_API_KEY is not configured" });
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
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
      text: {
        format: {
          type: "json_schema",
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

  const outputText = extractOutputText(data);
  if (!outputText) {
    sendJson(res, 502, { error: "The model response did not include deck JSON" });
    return;
  }

  const generated = JSON.parse(outputText);
  sendJson(res, 200, {
    slides: generated.slides.map((slide) => ({
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

function extractOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return "";
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
