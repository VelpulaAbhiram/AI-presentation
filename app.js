const themes = {
  aurora: {
    bg: "F8FBFD",
    surface: "FFFFFF",
    ink: "131820",
    muted: "667085",
    accent: "1B8A8F",
    accent2: "F2B544",
  },
  mono: {
    bg: "F4F4F1",
    surface: "FFFFFF",
    ink: "171717",
    muted: "6B6B64",
    accent: "2F5D50",
    accent2: "B6A16B",
  },
  signal: {
    bg: "F3F7FF",
    surface: "FFFFFF",
    ink: "101828",
    muted: "64748B",
    accent: "315CFF",
    accent2: "10A37F",
  },
  ember: {
    bg: "FFF8F3",
    surface: "FFFFFF",
    ink: "201A17",
    muted: "765E54",
    accent: "C95532",
    accent2: "2D8C73",
  },
};

let deck = [];
let selectedIndex = 0;

const $ = (id) => document.getElementById(id);

const topicWords = (prompt) =>
  prompt
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 9);

const titleCase = (text) =>
  text
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

async function makeDeckFromPrompt() {
  const generateBtn = $("generateBtn");
  generateBtn.disabled = true;
  generateBtn.textContent = "Generating...";

  try {
    const aiDeck = await generateDeckWithAi();
    if (aiDeck) {
      deck = aiDeck;
      selectedIndex = 0;
      render();
      toast("AI deck generated. Edit any slide, then export to PowerPoint.");
      return;
    }
  } catch (error) {
    console.warn(error);
    toast("AI generation unavailable. Using local generator.");
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = "Generate Deck";
  }

  makeLocalDeckFromPrompt();
}

async function generateDeckWithAi() {
  if (location.protocol === "file:") {
    return null;
  }

  const response = await fetch("/api/generate-deck", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: $("promptInput").value.trim(),
      slideCount: Number($("slideCount").value) || 7,
      style: $("styleSelect").value,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "AI generation failed");
  }

  return data.slides.map((slide) => ({
    id: slide.id || crypto.randomUUID(),
    title: slide.title,
    subtitle: slide.subtitle,
    layout: slide.layout,
    theme: slide.theme,
    bullets: slide.bullets,
    notes: slide.notes,
  }));
}

function makeLocalDeckFromPrompt() {
  const prompt = $("promptInput").value.trim() || "Create a business presentation";
  const count = Math.max(4, Math.min(10, Number($("slideCount").value) || 7));
  const style = $("styleSelect").value;
  const words = topicWords(prompt);
  const subject = titleCase(words.slice(0, 5).join(" ")) || "New Presentation";
  const tone = {
    executive: "clear executive narrative",
    startup: "bold startup story",
    consulting: "structured consulting logic",
    education: "simple learning flow",
  }[style];

  const blueprints = [
    ["hero", subject, `A ${tone} generated from your prompt in seconds.`],
    ["bullets", "Opportunity", `Why ${subject.toLowerCase()} matters right now.`],
    ["metrics", "Proof Points", "The strongest signals that make the idea credible."],
    ["comparison", "Solution", "A practical approach with polished presentation output."],
    ["timeline", "Roadmap", "A focused path from draft to share-ready deck."],
    ["bullets", "Go-To-Market", "How the story reaches the right audience."],
    ["metrics", "Business Impact", "The measurable value this deck should communicate."],
    ["comparison", "Risks And Responses", "What could slow adoption and how to address it."],
    ["bullets", "Next Steps", "The concrete actions after this presentation."],
    ["hero", "Thank You", "Ready to turn the idea into a polished presentation."],
  ];

  deck = blueprints.slice(0, count).map(([layout, title, subtitle], index) => ({
    id: crypto.randomUUID(),
    title,
    subtitle,
    layout,
    theme: index % 3 === 0 ? "aurora" : index % 3 === 1 ? "signal" : "mono",
    bullets: buildBullets(prompt, title, index),
    notes: `Talk track: connect ${title.toLowerCase()} back to the core prompt and keep the slide concise.`,
  }));

  selectedIndex = 0;
  render();
  toast("Deck generated. Edit any slide, then export to PowerPoint.");
}

function buildBullets(prompt, title, index) {
  const base = topicWords(`${title} ${prompt}`);
  const anchor = base[index % Math.max(base.length, 1)] || "design";
  return [
    `${title} is framed around ${anchor.toLowerCase()} and clear audience value`,
    "Editable slide structure with native text, shapes, and visual hierarchy",
    "Balanced content density for a polished presentation rhythm",
  ];
}

function render() {
  renderRail();
  renderStage();
  renderInspector();
}

function renderRail() {
  $("slidesRail").innerHTML = deck
    .map((slide, index) => {
      const theme = themes[slide.theme];
      return `
        <button class="thumb ${index === selectedIndex ? "active" : ""}" type="button" data-index="${index}">
          <div class="thumb-preview" style="background:#${theme.ink}; color:#${theme.surface}">
            <strong>${escapeHtml(slide.title)}</strong>
          </div>
          <span>${index + 1}. ${escapeHtml(slide.layout)}</span>
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
  $("slideStage").innerHTML = slideMarkup(slide, theme);
}

function slideMarkup(slide, theme) {
  const bullets = slide.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const common = `
    <div>
      <h2>${escapeHtml(slide.title)}</h2>
      <p>${escapeHtml(slide.subtitle)}</p>
    </div>
  `;

  if (slide.layout === "metrics") {
    return `
      <article class="slide metrics" style="background:#${theme.bg}">
        ${common}
        <div class="metric-row">
          <div class="metric"><strong>3x</strong><span>Faster draft creation</span></div>
          <div class="metric"><strong>92%</strong><span>Editable slide objects</span></div>
          <div class="metric"><strong>10</strong><span>Export-ready layouts</span></div>
        </div>
      </article>
    `;
  }

  if (slide.layout === "comparison") {
    return `
      <article class="slide comparison" style="background:#${theme.bg}">
        ${common}
        <div class="comparison-grid">
          <div class="compare-card"><strong>Before</strong><p>Manual outline, copy, layout, and export cleanup.</p></div>
          <div class="compare-card"><strong>After</strong><p>Prompt-driven draft with editable PowerPoint output.</p></div>
        </div>
      </article>
    `;
  }

  if (slide.layout === "timeline") {
    return `
      <article class="slide timeline" style="background:#${theme.bg}">
        ${common}
        <div class="timeline-grid">
          <div class="timeline-item"><strong>01</strong><p>Prompt</p></div>
          <div class="timeline-item"><strong>02</strong><p>Outline</p></div>
          <div class="timeline-item"><strong>03</strong><p>Edit</p></div>
          <div class="timeline-item"><strong>04</strong><p>Export</p></div>
        </div>
      </article>
    `;
  }

  if (slide.layout === "bullets") {
    return `
      <article class="slide bullets" style="background:#${theme.bg}">
        ${common}
        <ul>${bullets}</ul>
      </article>
    `;
  }

  return `
    <article class="slide hero" style="background:#${theme.bg}">
      ${common}
      <ul>${bullets.slice(0, 2)}</ul>
    </article>
  `;
}

function renderInspector() {
  const slide = deck[selectedIndex];
  $("titleInput").value = slide.title;
  $("subtitleInput").value = slide.subtitle;
  $("bulletsInput").value = slide.bullets.join("\n");
  $("notesInput").value = slide.notes;
  $("layoutInput").value = slide.layout;
  $("themeInput").value = slide.theme;

  renderSwatches();
}

function renderSwatches(theme = themes[deck[selectedIndex].theme]) {
  $("swatches").innerHTML = Object.values(theme)
    .slice(0, 4)
    .map((color) => `<div class="swatch" style="background:#${color}"></div>`)
    .join("");
}

function syncInspector() {
  const slide = deck[selectedIndex];
  slide.title = $("titleInput").value;
  slide.subtitle = $("subtitleInput").value;
  slide.bullets = $("bulletsInput").value.split("\n").filter(Boolean);
  slide.notes = $("notesInput").value;
  slide.layout = $("layoutInput").value;
  slide.theme = $("themeInput").value;
  renderRail();
  renderStage();
  renderSwatches();
}

function addSlide() {
  deck.splice(selectedIndex + 1, 0, {
    id: crypto.randomUUID(),
    title: "New Slide",
    subtitle: "Add a crisp message for this slide.",
    layout: "bullets",
    theme: deck[selectedIndex]?.theme || "aurora",
    bullets: ["Key idea", "Supporting proof", "Action or implication"],
    notes: "Add presenter notes here.",
  });
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

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2600);
}

async function downloadPptx() {
  if (location.protocol !== "file:") {
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
      return;
    } catch (error) {
      console.warn(error);
      toast("Server export unavailable. Using browser fallback.");
    }
  }

  const files = buildPptxFiles(deck);
  const blob = new Blob([zipFiles(files)], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
  saveBlob(blob, "ai-presentation-studio-deck.pptx");
  toast("PowerPoint exported.");
}

function saveBlob(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildPptxFiles(slides) {
  const files = {};
  files["[Content_Types].xml"] = contentTypes(slides.length);
  files["_rels/.rels"] = rootRels();
  files["docProps/app.xml"] = appProps(slides.length);
  files["docProps/core.xml"] = coreProps();
  files["ppt/presentation.xml"] = presentationXml(slides.length);
  files["ppt/_rels/presentation.xml.rels"] = presentationRels(slides.length);
  files["ppt/theme/theme1.xml"] = themeXml();
  files["ppt/slideMasters/slideMaster1.xml"] = slideMasterXml();
  files["ppt/slideMasters/_rels/slideMaster1.xml.rels"] = slideMasterRels();
  files["ppt/slideLayouts/slideLayout1.xml"] = slideLayoutXml();
  files["ppt/slideLayouts/_rels/slideLayout1.xml.rels"] = slideLayoutRels();

  slides.forEach((slide, index) => {
    files[`ppt/slides/slide${index + 1}.xml`] = slideXml(slide, index + 1);
    files[`ppt/slides/_rels/slide${index + 1}.xml.rels`] = slideRels(index + 1);
    files[`ppt/notesSlides/notesSlide${index + 1}.xml`] = notesXml(slide);
    files[`ppt/notesSlides/_rels/notesSlide${index + 1}.xml.rels`] = notesRels(index + 1);
  });
  return files;
}

function contentTypes(count) {
  const slideTypes = Array.from({ length: count }, (_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
  const noteTypes = Array.from({ length: count }, (_, i) => `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("");
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
${slideTypes}${noteTypes}</Types>`);
}

function rootRels() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
}

function appProps(count) {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>AI Presentation Studio</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${count}</Slides></Properties>`);
}

function coreProps() {
  const now = new Date().toISOString();
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>AI Presentation Studio Deck</dc:title><dc:creator>AI Presentation Studio</dc:creator><cp:lastModifiedBy>AI Presentation Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
}

function presentationXml(count) {
  const slideIds = Array.from({ length: count }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join("");
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`);
}

function presentationRels(count) {
  const slides = Array.from({ length: count }, (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join("");
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides}</Relationships>`);
}

function themeXml() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AI Studio"><a:themeElements><a:clrScheme name="AI Studio"><a:dk1><a:srgbClr val="131820"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1B8A8F"/></a:dk2><a:lt2><a:srgbClr val="F8FBFD"/></a:lt2><a:accent1><a:srgbClr val="1B8A8F"/></a:accent1><a:accent2><a:srgbClr val="F2B544"/></a:accent2><a:accent3><a:srgbClr val="315CFF"/></a:accent3><a:accent4><a:srgbClr val="10A37F"/></a:accent4><a:accent5><a:srgbClr val="C95532"/></a:accent5><a:accent6><a:srgbClr val="2D8C73"/></a:accent6><a:hlink><a:srgbClr val="315CFF"/></a:hlink><a:folHlink><a:srgbClr val="1B8A8F"/></a:folHlink></a:clrScheme><a:fontScheme name="Inter"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="AI Studio"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`);
}

function slideMasterXml() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`);
}

function slideMasterRels() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`);
}

function slideLayoutXml() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`);
}

function slideLayoutRels() {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`);
}

function slideXml(slide, index) {
  const theme = themes[slide.theme];
  const shapes = [
    rectShape(2, 0, 0, 12192000, 6858000, theme.bg, "Background"),
    textShape(3, slide.title, 720000, 620000, 7400000, 1100000, 34, theme.ink, true),
    textShape(4, slide.subtitle, 720000, 1700000, 6200000, 620000, 16, theme.muted, false),
    ...layoutShapes(slide, theme, index),
  ].join("");

  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
}

function layoutShapes(slide, theme, index) {
  if (slide.layout === "metrics") {
    return [
      cardShape(10, "3x", "Faster drafts", 760000, 3400000, theme),
      cardShape(11, "92%", "Editable objects", 4380000, 3400000, theme),
      cardShape(12, "10", "Smart layouts", 8000000, 3400000, theme),
    ];
  }
  if (slide.layout === "comparison") {
    return [
      rectShape(14, 6900000, 2200000, 2050000, 2500000, "FFFFFF", "Before"),
      rectShape(15, 9200000, 2200000, 2050000, 2500000, "FFFFFF", "After"),
      textShape(16, "Before\nManual copy, layout and cleanup", 7100000, 2500000, 1650000, 1300000, 16, theme.ink, true),
      textShape(17, "After\nPrompt-driven editable PowerPoint", 9400000, 2500000, 1650000, 1300000, 16, theme.accent, true),
    ];
  }
  if (slide.layout === "timeline") {
    return [0, 1, 2, 3]
      .map((step) => {
        const labels = ["Prompt", "Outline", "Edit", "Export"];
        return `${rectShape(20 + step, 900000 + step * 2700000, 3400000, 2100000, 1180000, step % 2 ? "FFFFFF" : theme.accent, labels[step])}${textShape(30 + step, `0${step + 1}\n${labels[step]}`, 1080000 + step * 2700000, 3650000, 1600000, 520000, 18, step % 2 ? theme.ink : "FFFFFF", true)}`;
      })
      .join("");
  }
  return bulletTextShape(8, slide.bullets, 720000, slide.layout === "hero" ? 4000000 : 2800000, 6700000, 2000000, theme);
}

function rectShape(id, x, y, cx, cy, color, name) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="DDE5EC"/></a:solidFill></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
}

function textShape(id, text, x, y, cx, cy, size, color, bold) {
  const lines = String(text).split("\n");
  const paragraphs = lines
    .map((line) => `<a:p><a:r><a:rPr lang="en-US" sz="${size * 100}" ${bold ? 'b="1"' : ""}><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${escapeXml(line)}</a:t></a:r></a:p>`)
    .join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function bulletTextShape(id, bullets, x, y, cx, cy, theme) {
  const paragraphs = bullets
    .map((item) => `<a:p><a:pPr marL="342900" indent="-228600"><a:buChar char="•"/></a:pPr><a:r><a:rPr lang="en-US" sz="1800"><a:solidFill><a:srgbClr val="${theme.ink}"/></a:solidFill></a:rPr><a:t>${escapeXml(item)}</a:t></a:r></a:p>`)
    .join("");
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Bullets"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs}</p:txBody></p:sp>`;
}

function cardShape(id, stat, label, x, y, theme) {
  return `${rectShape(id, x, y, 2700000, 1450000, "FFFFFF", label)}${textShape(id + 20, `${stat}\n${label}`, x + 220000, y + 250000, 2100000, 850000, 22, theme.accent, true)}`;
}

function slideRels(slideNumber) {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNumber}.xml"/></Relationships>`);
}

function notesXml(slide) {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${textShape(2, slide.notes, 800000, 800000, 5200000, 2200000, 14, "131820", false)}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
}

function notesRels(slideNumber) {
  return xml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNumber}.xml"/></Relationships>`);
}

function xml(value) {
  return value.replace(/>\s+</g, "><").trim();
}

function zipFiles(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    localParts.push(local);

    centralParts.push(concatBytes([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc),
      u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0),
      u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  });

  const central = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50), u16(0), u16(0), u16(centralParts.length), u16(centralParts.length),
    u32(central.length), u32(offset), u16(0),
  ]);
  return concatBytes([...localParts, central, end]);
}

function u16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

$("generateBtn").addEventListener("click", makeDeckFromPrompt);
$("downloadBtn").addEventListener("click", downloadPptx);
$("addSlideBtn").addEventListener("click", addSlide);
$("duplicateSlideBtn").addEventListener("click", duplicateSlide);
$("deleteSlideBtn").addEventListener("click", deleteSlide);
["titleInput", "subtitleInput", "bulletsInput", "notesInput", "layoutInput", "themeInput"].forEach((id) => {
  $(id).addEventListener("input", syncInspector);
});

makeDeckFromPrompt();
