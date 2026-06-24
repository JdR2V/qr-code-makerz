// qr.ts
// ---------------------------------------------------------------------------
// This module turns text into a QR code drawn on a <canvas>.
//
// We let the `qrcode` library do ONE thing: the hard math of encoding the text
// and adding Reed-Solomon error correction. That step produces a grid of
// black/white squares called "modules". Everything you can SEE -- colors, the
// quiet-zone border, the logo in the middle -- we draw ourselves so you can
// understand and control every pixel.
// ---------------------------------------------------------------------------

import QRCode from "qrcode";

// The four error-correction levels, weakest to strongest.
// Higher levels add more redundant data, so more of the code can be damaged or
// covered (e.g. by a logo) and still scan -- at the cost of a denser grid.
//   L ~7%   M ~15%   Q ~25%   H ~30%   of the code can be recovered.
export type ECCLevel = "L" | "M" | "Q" | "H";

export interface RenderOptions {
  text: string;
  ecc: ECCLevel;
  fg: string; // color of the dark modules
  bg: string; // background color (also fills the quiet zone)
  size: number; // target size of the whole image in CSS pixels
  margin?: number; // quiet-zone width measured in modules (spec minimum is 4)
  logo?: HTMLImageElement | null;
  logoScale?: number; // logo width as a fraction of the QR width (0.0 - ~0.3)
}

// Rounded-rectangle helper. ctx.roundRect exists in modern browsers, but we
// provide a fallback so older engines don't throw.
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Render a QR code for `opts.text` onto `canvas`.
 * Throws if the text is empty or too large to encode at the chosen ECC level.
 */
export function renderQR(canvas: HTMLCanvasElement, opts: RenderOptions): void {
  if (!opts.text) throw new Error("Nothing to encode yet.");

  const margin = opts.margin ?? 4;

  // 1. Encode. `qr.modules` is a square bit-matrix. Its `.data` is a flat
  //    Uint8Array where 1 = dark module, 0 = light. `.size` is the side length
  //    in modules (e.g. 25, 29, 33... it grows with how much data you store).
  const qr = QRCode.create(opts.text, { errorCorrectionLevel: opts.ecc });
  const count = qr.modules.size;
  const data = qr.modules.data;

  // 2. Work out pixel sizes. We add the quiet zone (margin) on every side, then
  //    snap each module to a whole number of pixels so edges stay razor-sharp.
  const totalModules = count + margin * 2;
  const moduleSize = Math.max(1, Math.floor(opts.size / totalModules));
  const dim = moduleSize * totalModules;

  // 3. Scale the canvas for high-DPI screens so it isn't blurry on phones.
  //    We pin only the display WIDTH and let height follow ("auto"), so when
  //    CSS caps the width on a narrow screen the code still scales as a square.
  const dpr = window.devicePixelRatio || 1;
  canvas.width = dim * dpr;
  canvas.height = dim * dpr;
  canvas.style.width = `${dim}px`;
  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // reset + apply DPI scale
  ctx.imageSmoothingEnabled = false;

  // 4. Paint the background. This also fills the quiet zone -- that empty border
  //    is not decoration, scanners NEED it to find where the code begins.
  ctx.fillStyle = opts.bg;
  ctx.fillRect(0, 0, dim, dim);

  // 5. Paint every dark module as a small filled square.
  ctx.fillStyle = opts.fg;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (data[row * count + col]) {
        const x = (col + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        ctx.fillRect(x, y, moduleSize, moduleSize);
      }
    }
  }

  // 6. Optional center logo. We punch a padded hole (filled with bg color) so
  //    the logo reads cleanly, then draw the image. The error correction added
  //    in step 1 is what lets the scanner still recover the data underneath.
  if (opts.logo) {
    const scale = Math.min(opts.logoScale ?? 0.22, 0.3);
    const qrPixels = count * moduleSize;
    const logoSize = Math.round(qrPixels * scale);
    const origin = margin * moduleSize + (qrPixels - logoSize) / 2;
    const pad = Math.round(moduleSize * 1.5);

    ctx.fillStyle = opts.bg;
    roundRect(
      ctx,
      origin - pad,
      origin - pad,
      logoSize + pad * 2,
      logoSize + pad * 2,
      moduleSize,
    );
    ctx.fill();

    ctx.drawImage(opts.logo, origin, origin, logoSize, logoSize);
  }
}

/** Read a chosen image file into an HTMLImageElement, resolved when loaded. */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}
