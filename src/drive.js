// Google Drive client: OAuth2 auth + listing/downloading receipt-like files.
// Credentials come from env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) and the
// token is persisted to token.json after `npm run auth`.
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const TOKEN_PATH = path.join(__dirname, "..", "token.json");
const SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

function redirectUri() {
  return (
    process.env.OAUTH_REDIRECT_URI ||
    `http://localhost:${process.env.PORT || 4000}/oauth2callback`
  );
}

function loadCreds() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret || id === "___" || secret === "___") return null;
  return { client_id: id, client_secret: secret, redirect_uris: [redirectUri()] };
}

function getClient() {
  const creds = loadCreds();
  if (!creds) return null;
  const client = new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uris[0]);
  if (fs.existsSync(TOKEN_PATH)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));
  }
  return client;
}

function authUrl() {
  const client = getClient();
  if (!client) throw new Error("Google credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES });
}

async function exchangeCode(code) {
  const client = getClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  return tokens;
}

// List files that look like receipts: images / PDFs whose name mentions
// receipt, invoice, bill, or expense (case-insensitive). Optionally scoped to
// a folder via GOOGLE_DRIVE_FOLDER_ID.
async function listReceiptFiles() {
  const client = getClient();
  if (!client || !client.credentials?.access_token) {
    throw new Error("Not authenticated. Run `npm run auth` first.");
  }
  const drive = google.drive({ version: "v3", auth: client });
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const q = [
    "trashed = false",
    "(mimeType = 'application/pdf' or mimeType contains 'image/')",
    "name contains 'receipt' or name contains 'invoice' or name contains 'bill' or name contains 'expense'",
    folder ? `'${folder}' in parents` : null,
  ].filter(Boolean).join(" and ");

  const res = await drive.files.list({
    q,
    pageSize: 100,
    fields: "files(id, name, mimeType, webViewLink, thumbnailLink, createdTime)",
    orderBy: "createdTime desc",
  });
  return res.data.files || [];
}

async function downloadFile(fileId) {
  const client = getClient();
  const drive = google.drive({ version: "v3", auth: client });
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(res.data);
}

module.exports = { loadCreds, getClient, authUrl, exchangeCode, listReceiptFiles, downloadFile, TOKEN_PATH, redirectUri };
