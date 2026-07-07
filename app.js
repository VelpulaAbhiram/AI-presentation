const themes = {
  aurora: { bg: "F7FBFC", surface: "FFFFFF", ink: "102024", muted: "5D6D75", line: "DDE8EA", accent: "00A6A6", accent2: "FFB84D" },
  graphite: { bg: "101419", surface: "1B222B", ink: "F7FAFC", muted: "BAC4D6", line: "303A46", accent: "8FE388", accent2: "79A7FF", dark: true },
  prism: { bg: "F7F4FF", surface: "FFFFFF", ink: "171321", muted: "6F667D", line: "E5DDF6", accent: "7C3AED", accent2: "06B6D4" },
  meadow: { bg: "F4FAF2", surface: "FFFFFF", ink: "152218", muted: "687864", line: "DDEAD9", accent: "2D8C54", accent2: "EAB308" },
  ember: { bg: "FFF7F1", surface: "FFFFFF", ink: "201714", muted: "80655A", line: "F0DDD4", accent: "D9572E", accent2: "157F72" },
  ocean: { bg: "F1F7FF", surface: "FFFFFF", ink: "0F1B2D", muted: "607089", line: "D7E4F5", accent: "2563EB", accent2: "14B8A6" },
  royal: { bg: "111224", surface: "1D2040", ink: "FFFFFF", muted: "C8C9E5", line: "34385F", accent: "F7C948", accent2: "9B8CFF", dark: true },
  sunset: { bg: "FFF4ED", surface: "FFFFFF", ink: "241611", muted: "84675C", line: "F2D8CC", accent: "E85D75", accent2: "F6BD60" },
};

const layouts = ["cover", "split", "bullets", "metrics", "comparison", "timeline", "quote", "image"];

let deck = [];
let selectedIndex = 0;
let previewIndex = 0;
let aiSettings = {
  apiKey: "",
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function topicWords(prompt) {
  return prompt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 10);
}

function titleCase(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function makeDeckFromPrompt() {
  const generateBtn = $("generateBtn");
  setButtonLoading(generateBtn, true, "Generating...");

  try {
    if ($("generationModeInput").value === "local") {
      makeLocalDeckFromPrompt();
      toast("Editable deck created without AI.");
      return;
    }

    const aiDeck = await generateDeckWithClaude();
    deck = aiDeck;
    selectedIndex = 0;
    render();
    toast("Claude deck generated. Preview, edit, or add visuals.");
  } catch (error) {
    console.warn(error);
    makeLocalDeckFromPrompt();
    toast("Claude unavailable. Local editable draft created.");
  } finally {
    setButtonLoading(generateBtn, false, "Generate PPT");
  }
}

async function generateDeckWithClaude() {
  if (location.protocol === "file:") throw new Error("Run the server to use AI.");

  const response = await fetch("/api/generate-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: $("promptInput").value.trim(),
      slideCount: Number($("slideCount").value) || 8,
      style: $("styleSelect").value,
      designPack: $("designPackInput").value,
      includeImages: $("includeImagesInput").checked,
      aiSettings: requestAiSettings(),
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Claude generation failed");

  $("providerPill").textContent = "Claude";
  return data.slides.map(normalizeSlide);
}

function makeLocalDeckFromPrompt() {
  const prompt = $("promptInput").value.trim() || "Create a business presentation";
  const count = Math.max(4, Math.min(12, Number($("slideCount").value) || 8));
  const subject = titleCase(topicWords(prompt).slice(0, 5).join(" ")) || "AI Presentation Studio";

  const blueprints = [
    ["cover", subject, "A polished AI-generated presentation draft with editable PowerPoint output."],
    ["split", "The Problem", "Teams lose time turning rough ideas into presentation-ready stories."],
    ["metrics", "Proof Points", "The strongest signals behind the opportunity."],
    ["comparison", "The Better Workflow", "Prompt, preview, edit, enrich with visuals, and export."],
    ["timeline", "Product Flow", "A fast path from idea to downloadable PowerPoint."],
    ["image", "Visual Storytelling", "AI-generated visuals help every deck feel designed."],
    ["quote", "Core Message", "Great slides should feel designed before a designer touches them."],
    ["bullets", "Next Steps", "Make the product useful, shareable, and easy to deploy."],
    ["cover", "Thank You", "Ready to turn the idea into a polished presentation."],
  ];

  deck = blueprints.slice(0, count).map(([layout, title, subtitle], index) =>
    normalizeSlide({
      id: crypto.randomUUID(),
      title,
      subtitle,
      kicker: index === 0 ? "GENERATED DRAFT" : "AI STUDIO",
      layout,
      theme: Object.keys(themes)[index % Object.keys(themes).length],
      bullets: buildBullets(prompt, title, index),
      metrics: defaultMetrics(),
      visualPrompt: `A premium 16:9 presentation visual for ${title}, modern SaaS design, clean composition, no tiny text`,
      notes: `Talk track: connect ${title.toLowerCase()} back to the user's core prompt.`,
    }),
  );

  selectedIndex = 0;
  render();
}

function buildBullets(prompt, title, index) {
  const base = topicWords(`${title} ${prompt}`);
  const anchor = base[index % Math.max(base.length, 1)] || "design";
  return [
    `${title} is framed around ${anchor.toLowerCase()} and clear audience value`,
    "Editable slide structure with native text, shapes, and hierarchy",
    "Preview-first workflow before downloading the PowerPoint file",
  ];
}

function defaultMetrics() {
  return [
    { value: "3x", label: "Faster draft creation" },
    { value: "92%", label: "Editable slide objects" },
    { value: "10+", label: "Design-ready layouts" },
  ];
}

function normalizeSlide(slide) {
  return {
    id: slide.id || crypto.randomUUID(),
    title: slide.title || "Untitled Slide",
    subtitle: slide.subtitle || "Add a clear message for this slide.",
    kicker: slide.kicker || "AI STUDIO",
    layout: layouts.includes(slide.layout) ? slide.layout : "bullets",
    theme: themes[slide.theme] ? slide.theme : "aurora",
    bullets: Array.isArray(slide.bullets) && slide.bullets.length ? slide.bullets : ["Key idea", "Supporting proof", "Action"],
    metrics: Array.isArray(slide.metrics) && slide.metrics.length ? slide.metrics : defaultMetrics(),
    visualPrompt: slide.visualPrompt || `A premium presentation visual for ${slide.title || "this slide"}, 16:9, clean modern design`,
    imageDataUrl: slide.imageDataUrl || "",
    notes: slide.notes || "Presenter notes go here.",
  };
}

function render() {
  if (!deck.length) return;
  selectedIndex = Math.max(0, Math.min(selectedIndex, deck.length - 1));
  renderRail();
  renderStage();
  renderInspector();
  renderThemeChips();
}

function renderRail() {
  $("slidesRail").innerHTML = deck
    .map((slide, index) => {
      const theme = themes[slide.theme];
      return `
        <button class="thumb ${index === selectedIndex ? "active" : ""}" type="button" data-index="${index}">
          <div class="thumb-preview" style="background:#${theme.bg}; color:#${theme.ink}; border-color:#${theme.line}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${escapeHtml(slide.title)}</strong>
          </div>
          <small>${escapeHtml(slide.layout)} / ${escapeHtml(slide.theme)}</small>
        </button>
      `;
    })
    .join("");

  document.querySelectorAll(".thumb").forEach((button) => {
    button.addEventListener("click", () => {
      selectedIndex = Number(button.dataset.index);
      render();
    });
  });
}

function renderStage() {
  const slide = deck[selectedIndex];
  const theme = themes[slide.theme];
  document.documentElement.style.setProperty("--accent", `#${theme.accent}`);
  document.documentElement.style.setProperty("--accent-2", `#${theme.accent2}`);
  $("slideCounter").textContent = `Slide ${selectedIndex + 1} of ${deck.length}`;
  $("slideStage").innerHTML = slideMarkup(slide, theme);
}

function slideMarkup(slide, theme) {
  const bullets = slide.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const image = slide.imageDataUrl ? `<img class="slide-image" src="${slide.imageDataUrl}" alt="" />` : `<div class="visual-placeholder"><strong>Slide Visual</strong><span>${escapeHtml(slide.visualPrompt)}</span></div>`;
  const metrics = slide.metrics
    .slice(0, 3)
    .map((item) => `<div class="metric"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>`)
    .join("");

  const header = `
    <div class="slide-copy">
      <span class="slide-kicker">${escapeHtml(slide.kicker)}</span>
      <h2>${escapeHtml(slide.title)}</h2>
      <p>${escapeHtml(slide.subtitle)}</p>
    </div>
  `;

  if (slide.layout === "metrics") {
    return `<article class="slide metrics" style="${themeStyle(theme)}">${header}<div class="metric-row">${metrics}</div>${decorMarkup()}</article>`;
  }

  if (slide.layout === "comparison") {
    return `
      <article class="slide comparison" style="${themeStyle(theme)}">
        ${header}
        <div class="comparison-grid">
          <div class="compare-card"><strong>Before</strong><p>${escapeHtml(slide.bullets[0] || "Manual decks are slow and inconsistent.")}</p></div>
          <div class="compare-card featured"><strong>After</strong><p>${escapeHtml(slide.bullets[1] || "AI creates a structured, editable deck workflow.")}</p></div>
        </div>
        ${decorMarkup()}
      </article>
    `;
  }

  if (slide.layout === "timeline") {
    const steps = (slide.bullets.length >= 4 ? slide.bullets.slice(0, 4) : ["Prompt", "Generate", "Preview", "Export"])
      .map((item, index) => `<div class="timeline-item"><strong>0${index + 1}</strong><span>${escapeHtml(item)}</span></div>`)
      .join("");
    return `<article class="slide timeline" style="${themeStyle(theme)}">${header}<div class="timeline-grid">${steps}</div>${decorMarkup()}</article>`;
  }

  if (slide.layout === "quote") {
    return `<article class="slide quote" style="${themeStyle(theme)}">${header}<blockquote>${escapeHtml(slide.bullets[0] || slide.subtitle)}</blockquote>${decorMarkup()}</article>`;
  }

  if (slide.layout === "split") {
    return `<article class="slide split" style="${themeStyle(theme)}">${header}<div class="visual-slot">${image}</div><ul>${bullets}</ul>${decorMarkup()}</article>`;
  }

  if (slide.layout === "image") {
    return `<article class="slide image-layout" style="${themeStyle(theme)}">${header}<div class="wide-visual">${image}</div><ul>${bullets}</ul>${decorMarkup()}</article>`;
  }

  if (slide.layout === "cover") {
    return `<article class="slide cover" style="${themeStyle(theme)}">${header}<div class="visual-slot">${image}</div><ul>${bullets.slice(0, 2)}</ul>${decorMarkup()}</article>`;
  }

  return `<article class="slide bullets" style="${themeStyle(theme)}">${header}<ul>${bullets}</ul>${decorMarkup()}</article>`;
}

function themeStyle(theme) {
  return `--slide-bg:#${theme.bg}; --slide-surface:#${theme.surface}; --slide-ink:#${theme.ink}; --slide-muted:#${theme.muted}; --slide-line:#${theme.line}; --slide-accent:#${theme.accent}; --slide-accent-2:#${theme.accent2};`;
}

function decorMarkup() {
  return `<span class="decor-ring"></span><span class="decor-bar"></span>`;
}

function renderInspector() {
  const slide = deck[selectedIndex];
  $("kickerInput").value = slide.kicker;
  $("titleInput").value = slide.title;
  $("subtitleInput").value = slide.subtitle;
  $("bulletsInput").value = slide.bullets.join("\n");
  $("notesInput").value = slide.notes;
  $("layoutInput").value = slide.layout;
  $("themeInput").value = slide.theme;
  $("visualPromptInput").value = slide.visualPrompt;
  renderSwatches();
}

function renderSwatches() {
  const theme = themes[deck[selectedIndex].theme];
  $("swatches").innerHTML = [theme.bg, theme.surface, theme.ink, theme.accent, theme.accent2]
    .map((color) => `<div class="swatch" style="background:#${color}"></div>`)
    .join("");
}

function renderThemeChips() {
  $("themeChips").innerHTML = Object.keys(themes)
    .map((name) => `<button type="button" class="theme-chip ${deck[selectedIndex].theme === name ? "active" : ""}" data-theme="${name}">${name}</button>`)
    .join("");
  document.querySelectorAll(".theme-chip").forEach((button) => {
    button.addEventListener("click", () => {
      deck[selectedIndex].theme = button.dataset.theme;
      render();
    });
  });
}

function syncInspector() {
  const slide = deck[selectedIndex];
  slide.kicker = $("kickerInput").value;
  slide.title = $("titleInput").value;
  slide.subtitle = $("subtitleInput").value;
  slide.bullets = $("bulletsInput").value.split("\n").map((line) => line.trim()).filter(Boolean);
  slide.notes = $("notesInput").value;
  slide.layout = $("layoutInput").value;
  slide.theme = $("themeInput").value;
  slide.visualPrompt = $("visualPromptInput").value;
  renderRail();
  renderStage();
  renderSwatches();
  renderThemeChips();
}

async function generateImageForSlide() {
  const button = $("generateImageBtn");
  const slide = deck[selectedIndex];
  setButtonLoading(button, true, "Creating...");

  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: slide.visualPrompt, theme: slide.theme, aiSettings: requestAiSettings() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Image generation failed");
    slide.imageDataUrl = data.dataUrl;
    if (!["cover", "split", "image"].includes(slide.layout)) slide.layout = "image";
    render();
    toast("Slide visual added to the selected slide.");
  } catch (error) {
    console.warn(error);
    toast("Visual creation failed. Try a shorter prompt.");
  } finally {
    setButtonLoading(button, false, "Create Slide Visual");
  }
}

function loadAiSettings() {
  const saved = localStorage.getItem("aiPresentationStudio.aiSettings");
  if (saved) {
    try {
      aiSettings = { ...aiSettings, ...JSON.parse(saved) };
    } catch (error) {
      console.warn(error);
    }
  }
  renderAiSettings();
}

function renderAiSettings() {
  $("apiKeyInput").value = aiSettings.apiKey;
  $("keyStatusPill").textContent = aiSettings.apiKey ? "Saved" : "Server";
  $("providerPill").textContent = "Claude";
  updateGenerationModeUi();
}

function readAiSettingsForm() {
  aiSettings = {
    apiKey: $("apiKeyInput").value.trim(),
  };
  renderAiSettings();
}

function requestAiSettings() {
  return {
    provider: "claude",
    keyMode: aiSettings.apiKey ? "custom" : "basic",
    apiKey: aiSettings.apiKey,
  };
}

function saveAiSettings() {
  readAiSettingsForm();
  localStorage.setItem("aiPresentationStudio.aiSettings", JSON.stringify(aiSettings));
  toast("Claude API key saved in this browser.");
}

function clearAiSettings() {
  localStorage.removeItem("aiPresentationStudio.aiSettings");
  aiSettings = {
    apiKey: "",
  };
  renderAiSettings();
  toast("API key cleared.");
}

async function testAiSettings() {
  readAiSettingsForm();
  const button = $("testAiSettingsBtn");
  setButtonLoading(button, true, "Testing...");
  try {
    const response = await fetch("/api/generate-deck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Create a four slide test deck for an AI presentation app.",
        slideCount: 4,
        style: "test",
        designPack: "clean",
        includeImages: false,
        aiSettings: requestAiSettings(),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Test failed");
    toast("Claude key works.");
  } catch (error) {
    console.warn(error);
    toast(error.message || "AI settings test failed.");
  } finally {
    setButtonLoading(button, false, "Test");
  }
}

function updateGenerationModeUi() {
  const localMode = $("generationModeInput").value === "local";
  $("providerPill").textContent = localMode ? "No AI" : "Claude";
  $("includeImagesInput").disabled = localMode;
}

function clearSlideImage() {
  deck[selectedIndex].imageDataUrl = "";
  renderStage();
  toast("Slide image cleared.");
}

function addSlide() {
  deck.splice(selectedIndex + 1, 0, normalizeSlide({
    title: "New Slide",
    subtitle: "Add a crisp message for this slide.",
    layout: "bullets",
    theme: deck[selectedIndex]?.theme || "aurora",
    bullets: ["Key idea", "Supporting proof", "Action or implication"],
    metrics: defaultMetrics(),
    visualPrompt: "A clean premium 16:9 business presentation visual, modern and minimal",
    notes: "Add presenter notes here.",
  }));
  selectedIndex += 1;
  render();
}

function duplicateSlide() {
  const copy = structuredClone(deck[selectedIndex]);
  copy.id = crypto.randomUUID();
  copy.title = `${copy.title} Copy`;
  deck.splice(selectedIndex + 1, 0, copy);
  selectedIndex += 1;
  render();
}

function deleteSlide() {
  if (deck.length <= 1) {
    toast("Keep at least one slide in the deck.");
    return;
  }
  deck.splice(selectedIndex, 1);
  selectedIndex = Math.max(0, selectedIndex - 1);
  render();
}

async function downloadPptx() {
  const button = $("downloadBtn");
  setButtonLoading(button, true, "Exporting...");

  try {
    const response = await fetch("/api/export-pptx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slides: deck }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "PowerPoint export failed");
    }
    const blob = await response.blob();
    saveBlob(blob, "ai-presentation-studio-deck.pptx");
    toast("PowerPoint exported.");
  } catch (error) {
    console.warn(error);
    try {
      await browserExportPptx();
      toast("PowerPoint exported in browser fallback mode.");
    } catch (fallbackError) {
      console.warn(fallbackError);
      toast("PowerPoint download failed. Try Codespaces/local server or use Save Editable Project.");
    }
  } finally {
    setButtonLoading(button, false, "Download PowerPoint");
  }
}

async function browserExportPptx() {
  const PptxCtor = window.pptxgen || window.PptxGenJS || window.pptxgenjs;
  if (!PptxCtor) throw new Error("Browser PPTX library is not loaded");

  const pptx = new PptxCtor();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "AI Presentation Studio";
  pptx.subject = "Editable presentation";
  pptx.title = "AI Presentation Studio Deck";
  pptx.company = "AI Presentation Studio";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "en-US",
  };

  deck.forEach((slide, index) => addBrowserPptxSlide(pptx, slide, index));
  const blob = await pptx.write({ outputType: "blob" });
  saveBlob(blob, "ai-presentation-studio-deck.pptx");
}

function addBrowserPptxSlide(pptx, deckSlide, index) {
  const slide = pptx.addSlide();
  const theme = themes[deckSlide.theme] || themes.aurora;

  slide.background = { color: theme.bg };
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: theme.bg },
    line: { color: theme.bg },
  });
  slide.addShape("arc", {
    x: 10.55,
    y: -0.28,
    w: 2.7,
    h: 2.7,
    fill: { color: theme.accent2, transparency: 20 },
    line: { color: theme.accent2, transparency: 100 },
    rotate: 20,
  });
  slide.addShape("rect", {
    x: 0,
    y: 7.22,
    w: 13.333,
    h: 0.28,
    fill: { color: theme.accent },
    line: { color: theme.accent },
  });

  slide.addText(deckSlide.kicker || "AI STUDIO", {
    x: 0.65,
    y: 0.42,
    w: 4,
    h: 0.24,
    fontSize: 8,
    bold: true,
    color: theme.accent,
    margin: 0,
  });
  slide.addText(deckSlide.title || "Untitled Slide", {
    x: 0.65,
    y: 0.78,
    w: 7.8,
    h: 0.85,
    fontFace: "Aptos Display",
    fontSize: 30,
    bold: true,
    color: theme.ink,
    fit: "shrink",
    margin: 0,
  });
  slide.addText(deckSlide.subtitle || "", {
    x: 0.68,
    y: 1.74,
    w: 7.2,
    h: 0.55,
    fontSize: 13,
    color: theme.muted,
    fit: "shrink",
    margin: 0,
  });

  if (isBrowserImageUsable(deckSlide.imageDataUrl) && ["cover", "split", "image"].includes(deckSlide.layout)) {
    slide.addImage({ data: deckSlide.imageDataUrl, x: 8.35, y: 1.05, w: 4.35, h: 3.25 });
  }

  if (deckSlide.layout === "metrics") {
    addBrowserMetrics(slide, deckSlide, theme);
  } else if (deckSlide.layout === "comparison") {
    addBrowserComparison(slide, deckSlide, theme);
  } else if (deckSlide.layout === "timeline") {
    addBrowserTimeline(slide, deckSlide, theme);
  } else if (deckSlide.layout === "quote") {
    slide.addText(`"${deckSlide.bullets?.[0] || deckSlide.subtitle || ""}"`, {
      x: 1.15,
      y: 3.05,
      w: 8.6,
      h: 1.2,
      fontSize: 26,
      bold: true,
      italic: true,
      color: theme.ink,
      fit: "shrink",
      margin: 0,
    });
  } else {
    addBrowserBullets(slide, deckSlide, theme, ["cover", "image"].includes(deckSlide.layout) ? 4.25 : 2.75);
  }

  slide.addText(String(index + 1).padStart(2, "0"), {
    x: 12.1,
    y: 6.95,
    w: 0.55,
    h: 0.24,
    fontSize: 8,
    color: theme.muted,
    align: "right",
    margin: 0,
  });
  if (deckSlide.notes) slide.addNotes(deckSlide.notes);
}

function addBrowserBullets(slide, deckSlide, theme, y) {
  const items = (deckSlide.bullets || []).slice(0, 5).map((bullet) => ({
    text: bullet,
    options: { bullet: { type: "bullet" }, hanging: 4, breakLine: true },
  }));
  slide.addText(items, {
    x: 0.82,
    y,
    w: 7.2,
    h: 2.4,
    fontSize: 14,
    color: theme.ink,
    fit: "shrink",
    paraSpaceAfterPt: 8,
    margin: 0.04,
  });
}

function addBrowserMetrics(slide, deckSlide, theme) {
  const metrics = deckSlide.metrics?.length ? deckSlide.metrics : defaultMetrics();
  metrics.slice(0, 3).forEach((metric, index) => {
    const x = 0.78 + index * 3.85;
    slide.addShape("roundRect", { x, y: 3.45, w: 3.08, h: 1.52, fill: { color: theme.surface }, line: { color: theme.line } });
    slide.addText(metric.value, { x: x + 0.28, y: 3.72, w: 1.8, h: 0.48, fontSize: 28, bold: true, color: theme.accent, margin: 0, fit: "shrink" });
    slide.addText(metric.label, { x: x + 0.3, y: 4.3, w: 2.35, h: 0.34, fontSize: 10, color: theme.muted, margin: 0, fit: "shrink" });
  });
}

function addBrowserComparison(slide, deckSlide, theme) {
  [
    ["Before", deckSlide.bullets?.[0] || "Manual workflow is slow.", 7.1, theme.ink],
    ["After", deckSlide.bullets?.[1] || "AI creates an editable workflow.", 9.75, theme.accent],
  ].forEach(([title, body, x, color]) => {
    slide.addShape("roundRect", { x, y: 2.62, w: 2.48, h: 2.42, fill: { color: theme.surface }, line: { color: theme.line } });
    slide.addText(title, { x: x + 0.25, y: 2.94, w: 1.8, h: 0.34, fontSize: 16, bold: true, color, margin: 0 });
    slide.addText(body, { x: x + 0.25, y: 3.45, w: 1.86, h: 0.95, fontSize: 10.5, color: theme.muted, fit: "shrink", margin: 0 });
  });
}

function addBrowserTimeline(slide, deckSlide, theme) {
  const items = deckSlide.bullets?.length >= 4 ? deckSlide.bullets.slice(0, 4) : ["Generate", "Preview", "Edit", "Export"];
  items.forEach((label, index) => {
    const x = 0.9 + index * 2.9;
    const filled = index % 2 === 0;
    slide.addShape("roundRect", { x, y: 3.45, w: 2.38, h: 1.12, fill: { color: filled ? theme.accent : theme.surface }, line: { color: filled ? theme.accent : theme.line } });
    slide.addText(`0${index + 1}`, { x: x + 0.22, y: 3.66, w: 0.5, h: 0.22, fontSize: 9, bold: true, color: filled ? "FFFFFF" : theme.accent, margin: 0 });
    slide.addText(label, { x: x + 0.22, y: 3.94, w: 1.72, h: 0.32, fontSize: 13, bold: true, color: filled ? "FFFFFF" : theme.ink, margin: 0, fit: "shrink" });
  });
}

function isBrowserImageUsable(value) {
  return /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(String(value || "")) && String(value || "").length < 9_000_000;
}

function saveBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function saveProject() {
  const project = {
    version: 1,
    savedAt: new Date().toISOString(),
    slides: deck,
  };
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  saveBlob(blob, "ai-presentation-studio-project.json");
}

async function loadProject(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const project = JSON.parse(text);
    const slides = Array.isArray(project.slides) ? project.slides : Array.isArray(project) ? project : [];
    if (!slides.length) throw new Error("No slides found");
    deck = slides.map(normalizeSlide);
    selectedIndex = 0;
    render();
    toast("Editable project loaded.");
  } catch (error) {
    console.warn(error);
    toast("Could not load that project file.");
  } finally {
    event.target.value = "";
  }
}

function openPreview() {
  previewIndex = selectedIndex;
  $("previewModal").classList.add("show");
  $("previewModal").setAttribute("aria-hidden", "false");
  renderPreview();
}

function closePreview() {
  $("previewModal").classList.remove("show");
  $("previewModal").setAttribute("aria-hidden", "true");
}

function renderPreview() {
  $("previewSlide").innerHTML = slideMarkup(deck[previewIndex], themes[deck[previewIndex].theme]);
}

function movePreview(direction) {
  previewIndex = (previewIndex + direction + deck.length) % deck.length;
  selectedIndex = previewIndex;
  render();
  renderPreview();
}

function setButtonLoading(button, isLoading, text) {
  button.disabled = isLoading;
  button.textContent = text;
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2800);
}

$("generateBtn").addEventListener("click", makeDeckFromPrompt);
$("downloadBtn").addEventListener("click", downloadPptx);
$("saveProjectBtn").addEventListener("click", saveProject);
$("loadProjectInput").addEventListener("change", loadProject);
$("previewBtn").addEventListener("click", openPreview);
$("closePreviewBtn").addEventListener("click", closePreview);
$("prevPreviewBtn").addEventListener("click", () => movePreview(-1));
$("nextPreviewBtn").addEventListener("click", () => movePreview(1));
$("addSlideBtn").addEventListener("click", addSlide);
$("duplicateSlideBtn").addEventListener("click", duplicateSlide);
$("deleteSlideBtn").addEventListener("click", deleteSlide);
$("generateImageBtn").addEventListener("click", generateImageForSlide);
$("clearImageBtn").addEventListener("click", clearSlideImage);
$("saveAiSettingsBtn").addEventListener("click", saveAiSettings);
$("testAiSettingsBtn").addEventListener("click", testAiSettings);
$("clearAiSettingsBtn").addEventListener("click", clearAiSettings);
$("generationModeInput").addEventListener("change", updateGenerationModeUi);

["kickerInput", "titleInput", "subtitleInput", "bulletsInput", "notesInput", "layoutInput", "themeInput", "visualPromptInput"].forEach((id) => {
  $(id).addEventListener("input", syncInspector);
});

loadAiSettings();
makeLocalDeckFromPrompt();
