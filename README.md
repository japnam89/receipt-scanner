# Receipt Scanner

A small **Node.js REST API** that scans your **Google Drive** for receipts,
runs **OCR** (Tesseract.js locally, no API key), and stores structured data
(merchant, total, date) you can **Create / Read / Update / Delete** via REST.

## Quick start

```bash
cd receipt-scanner
npm install
cp .env.example .env        # fill GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
npm start                   # http://localhost:4000
```

### Connect Google Drive (one time)
1. Create an **OAuth 2.0 Client ID** at
   https://console.cloud.google.com/apis/credentials
   (add `http://localhost:4000/oauth2callback` as an authorized redirect URI,
   and enable the **Google Drive API**).
2. Put the client id/secret in `.env`.
3. Open http://localhost:4000/auth, authorize, and the token is saved.

### Deploy behind japnam.tech/receipt (Traefik)
The repo includes `docker-compose.yml` that mounts this app at
**https://japnam.tech/receipt** via the existing Traefik (path stripping +
letsencrypt TLS). It's a separate container from the portfolio/hibid stacks.

See **[DEPLOY.md](./DEPLOY.md)** for the full deploy runbook — including the
GitHub Actions automatic deploy (SSH into the VPS after a green CI run) and a
manual `docker compose` path.

```bash
cd receipt-scanner
cp .env.example .env
# fill GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, and set:
#   OAUTH_REDIRECT_URI=https://japnam.tech/receipt/oauth2callback
#   BASE_PATH=/receipt
docker compose up -d --build
```

Then:
1. Open **https://japnam.tech/receipt/auth** and authorize Google Drive.
   (Add `https://japnam.tech/receipt/oauth2callback` as an authorized redirect
   URI in the Google Cloud OAuth client.)
2. `POST https://japnam.tech/receipt/api/scan` to pull + OCR receipts.
3. Dashboard + CRUD at **https://japnam.tech/receipt**.

> The Traefik rule is `Host(\`japnam.tech\`) && PathPrefix(\`/receipt\`)`, so it
> coexists with the portfolio site (served at `/`) on the same host.

## How it works
- `src/drive.js` — Google OAuth2 + Drive list/download (read-only scope).
- `src/ocr.js` — Tesseract.js for images, pdf-parse for PDFs; heuristic
  extraction of merchant/total/date.
- `src/scan.js` — orchestrates list → download → OCR → upsert.
- `src/db.js` — better-sqlite3 store (file DB, no server).
- `server.js` — Express routes.

## Notes
- Scan filters Drive to images/PDFs whose name contains
  `receipt|invoice|bill|expense`. Set `GOOGLE_DRIVE_FOLDER_ID` to scope to one folder.
- OCR is heuristic; for production accuracy swap `src/ocr.js` for Google Vision
  or an LLM with vision.
- CRUD works even before Drive is connected (you can POST receipts manually).

## Troubleshooting: `https://japnam.tech/receipt` returns the portfolio's 404
This app is a **separate container** from the portfolio — deploying/redeploying
the portfolio does NOT touch it. If `/receipt` shows Next.js's 404 (look for
`x-nextjs-prerender` in the response headers), Traefik isn't routing to this
container, which means it's not running. On the VPS:

```bash
cd /opt/data/receipt-scanner
docker compose ps            # should show "receipt-scanner" Up (healthy)
docker compose up -d --build # (re)start it if missing/down
curl -fsS https://japnam.tech/receipt/healthz   # expect {"ok":true,...}
```

Also confirm `cp .env.example .env` exists — `docker-compose.yml` mounts `.env`
via `env_file`, so a missing `.env` will make the deploy fail.
