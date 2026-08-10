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

### Scan + CRUD
```bash
curl -X POST http://localhost:4000/api/scan          # pull receipts from Drive
curl http://localhost:4000/api/receipts              # list
curl http://localhost:4000/api/receipts/1            # read
curl -X PUT http://localhost:4000/api/receipts/1 \
  -H 'Content-Type: application/json' \
  -d '{"merchant":"Costco","total":42.10,"currency":"$"}'   # update
curl -X DELETE http://localhost:4000/api/receipts/1  # delete
```

You can also just open http://localhost:4000 for a tiny dashboard.

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
