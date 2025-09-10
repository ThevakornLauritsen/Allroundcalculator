# Danish Salary & Budget Calculator

A tiny Vite + React + Tailwind app that replicates your Excel salary calculator (AM, Pension, ATP, Fradrag, Tax) and lets you split your net into Essentials / Fun / Future You.

## Quick start

1. Install Node.js LTS (>= 18) from https://nodejs.org/
2. In a terminal, `cd` into this folder and run:

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

The production files are created in `dist/`.

## Deploy

### Vercel (recommended)

- Create a new Vercel project and import your GitHub repo for this folder.
- Framework preset: **Vite**.
- Build command: `vite build`
- Output directory: `dist`

### Netlify

- Connect your repo in Netlify.
- Build command: `vite build`
- Publish directory: `dist`

### GitHub Pages (static hosting)

```bash
npm run build
# push the contents of dist/ to a gh-pages branch or use an action that deploys dist/
```

## Tech

- React 18 + Vite 5
- Tailwind CSS 3

All values are saved to `localStorage`, and amounts formatted as DKK.
