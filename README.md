# QR Code Makerz

A free, no-nonsense QR code generator that works entirely in your browser. Paste a link, tweak the colors, drop in a logo if you want, and download your code as a PNG — no ads, no sign-up, no files uploaded anywhere.

## What it does

- Generates a QR code instantly from any link or text
- Lets you pick the code color and background color
- Supports a center logo (like those Instagram-style codes)
- Warns you if your color combo might not scan well
- Downloads the result as a PNG, ready to print or share

## How to use it

Just open the site and start typing. Everything updates live.

If you add a logo, switch error correction to **H** — it gives the code enough built-in redundancy to survive the logo covering part of it. The app will nudge you toward this automatically.

## Running it locally

You'll need [Node.js](https://nodejs.org) installed (LTS version is fine).

```bash
npm install      # first time only
npm run dev      # opens a local dev server with live reload
```

## Tech

Vanilla HTML, CSS, and TypeScript. Built with [Vite](https://vitejs.dev). No framework, no backend, no tracking. The only dependency is the `qrcode` library, which handles the encoding math — everything you see on screen is drawn by hand on a `<canvas>`.
