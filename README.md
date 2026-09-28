# GridIron Frontend

Standalone React + Vite frontend for GridIron Charting. This folder is its own Git repository and can be opened in VS Code independently of the backend.

## Prerequisites

- Node.js 22.12+ or 24+
- npm
- GridIron Backend running locally (default: `http://127.0.0.1:8000`)

## Install

```bash
npm install
```

## Configure

No API keys or secrets are required.

The optional `.env` setting is:

```env
BACKEND_URL=http://127.0.0.1:8000
```

Copy `.env.example` to `.env` only if you want to change the backend URL/port.

## Run

Start the backend repository first, then in this folder run:

```bash
npm run dev
```

Open `http://127.0.0.1:5173`.

The Vite dev server proxies `/api` and `/media` requests to `BACKEND_URL`, so browser CORS configuration is not required for the default local setup.

## Production build

```bash
npm run build
npm run preview
```

Preview runs on `http://127.0.0.1:4173` and still requires the backend.

## GitHub

```bash
git init
git add .
git commit -m "Initial GridIron frontend"
git branch -M main
git remote add origin YOUR_FRONTEND_REPOSITORY_URL
git push -u origin main
```

## Testing real clips

Once the backend is running, create a game in the UI and use **Upload clips**. Multiple clips can be selected at once; they are uploaded in natural filename order.
