# INZRA Bulk Map Point Generator

Version 6.1 — a professional geospatial tool that generates structured circular coordinate datasets around a center point, for map point analysis and bulk mapping (e.g. Google My Maps).

By [INZRA](https://www.inzra.com) · SEO by [SEO Service LK](https://seoservice.lk)

## Features

- Enter a center as `latitude, longitude` or paste a Google Maps URL
- Set a radius in kilometers, meters or miles
- Paste lists of point names and URLs
- Preview the generated dataset before exporting
- Bulk ZIP export (1 to 10 datasets)
- One-click link to Google My Maps for import

## Tech stack

React 19, TypeScript, Vite, Tailwind CSS, JSZip

## Run locally

**Prerequisites:** Node.js

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000.

If you use Gemini-powered features, set `GEMINI_API_KEY` in `.env.local`.

## Build

```bash
npm run build
npm run preview
```

## Links

- INZRA: https://www.inzra.com
- SEO Service LK: https://seoservice.lk
