// main.ts
// Wires the form controls to the renderer in qr.ts and handles PNG download.

import "./style.css";
import { renderQR, loadImageFile, type ECCLevel } from "./qr";

// --- Grab elements (the "!" tells TS we trust these exist in index.html) ---
const $ = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;

const textInput = $<HTMLTextAreaElement>("text");
const eccSelect = $<HTMLSelectElement>("ecc");
const fgInput = $<HTMLInputElement>("fg");
const bgInput = $<HTMLInputElement>("bg");
const logoInput = $<HTMLInputElement>("logo");
const logoClear = $<HTMLButtonElement>("logo-clear");
const downloadBtn = $<HTMLButtonElement>("download");
const canvas = $<HTMLCanvasElement>("preview");
const status = $<HTMLParagraphElement>("status");
const eccHint = $<HTMLParagraphElement>("ecc-hint");
const contrastWarn = $<HTMLParagraphElement>("contrast-warn");

let logo: HTMLImageElement | null = null;

// --- Rendering ---
function draw(): void {
  const text = textInput.value.trim();

  // Empty state: clear the canvas and disable download.
  if (!text) {
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.removeAttribute("style");
    canvas.width = 0;
    canvas.height = 0;
    downloadBtn.disabled = true;
    setStatus("Type or paste a link to generate a code.");
    contrastWarn.hidden = true;
    return;
  }

  try {
    renderQR(canvas, {
      text,
      ecc: eccSelect.value as ECCLevel,
      fg: fgInput.value,
      bg: bgInput.value,
      size: 512,
      logo,
      logoScale: 0.22,
    });
    downloadBtn.disabled = false;
    setStatus(`Encoded ${text.length} characters.`);
  } catch (err) {
    downloadBtn.disabled = true;
    setStatus(
      err instanceof Error ? err.message : "Could not generate code.",
      true,
    );
  }

  updateEccHint();
  updateContrastWarning();
}

function setStatus(message: string, isError = false): void {
  status.textContent = message;
  status.classList.toggle("status--error", isError);
}

// Warn when a logo sits on a code too weak to survive being covered.
function updateEccHint(): void {
  if (logo && eccSelect.value === "M") {
    eccHint.textContent =
      "Tip: Q or H give a logo the most room to stay scannable.";
    eccHint.hidden = false;
  } else {
    eccHint.hidden = true;
  }
}

// --- Contrast check -------------------------------------------------------
// Scanners need the code clearly darker than its background. We compute the
// WCAG relative luminance of each color, then warn on two problems:
//   1. an "inverted" code (lighter modules than background), which many
//      scanners refuse outright, and
//   2. low overall contrast, which is unreliable under poor lighting.
function relativeLuminance(hex: string): number {
  const v = hex.replace("#", "");
  const channel = (i: number) => {
    const s = parseInt(v.slice(i, i + 2), 16) / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function updateContrastWarning(): void {
  const fgLum = relativeLuminance(fgInput.value);
  const bgLum = relativeLuminance(bgInput.value);
  const ratio =
    (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

  let message = "";
  if (fgLum > bgLum) {
    message =
      "Heads up: the code is lighter than its background. Keep modules darker than the background or many scanners won't read it.";
  } else if (ratio < 3) {
    message =
      "Heads up: low contrast between code and background may not scan reliably. Try a darker code or lighter background.";
  }

  contrastWarn.textContent = message;
  contrastWarn.hidden = message === "";
}

// --- Events ---
// Debounce the text box so we don't redraw on every single keystroke.
let typingTimer: number | undefined;
textInput.addEventListener("input", () => {
  window.clearTimeout(typingTimer);
  typingTimer = window.setTimeout(draw, 120);
});

eccSelect.addEventListener("change", draw);
fgInput.addEventListener("input", draw);
bgInput.addEventListener("input", draw);

logoInput.addEventListener("change", async () => {
  const file = logoInput.files?.[0];
  if (!file) return;
  try {
    logo = await loadImageFile(file);
    logoClear.hidden = false;
    draw();
  } catch (err) {
    setStatus(
      err instanceof Error ? err.message : "Could not read image.",
      true,
    );
  }
});

logoClear.addEventListener("click", () => {
  logo = null;
  logoInput.value = "";
  logoClear.hidden = true;
  draw();
});

downloadBtn.addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.png";
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

// First paint.
draw();
