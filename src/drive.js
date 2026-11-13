// Google Drive client: OAuth2 auth + listing/downloading receipt-like files.
// Credentials come from env (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), and the
// authorized account's token is persisted to token.json after web sign-in.
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

function createClient() {
  const creds = loadCreds();
  if (!creds) return null;
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uris[0]);
}

function getClient() {
  const client = createClient();
  if (!client) return null;
  if (fs.existsSync(TOKEN_PATH)) {
    client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8")));
  }
  return client;
}

function authUrl(state) {
  const client = createClient();
  if (!client) throw new Error("Google credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  if (!state) throw new Error("OAuth state is required. Start sign-in from the app's /auth page.");
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: SCOPES, state });
}

async function exchangeCode(code) {
  const client = createClient();
  if (!client) throw new Error("Google credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const profile = await getProfileForClient(client);
  return { tokens, profile };
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  fs.chmodSync(TOKEN_PATH, 0o600);
}

async function getProfileForClient(client) {
  const drive = google.drive({ version: "v3", auth: client });
  const response = await drive.about.get({ fields: "user(displayName,emailAddress)" });
  return {
    name: response.data.user?.displayName || "",
    email: response.data.user?.emailAddress || "",
  };
}

async function getProfile() {
  const client = getClient();
  if (!client || !client.credentials?.access_token) {
    throw new Error("Google Drive is not connected. Sign in with the authorized Google account.");
  }
  return getProfileForClient(client);
}

// List files that look like receipts: images / PDFs whose name mentions
// receipt, invoice, bill, or expense (case-insensitive). Optionally scoped to
// a folder via GOOGLE_DRIVE_FOLDER_ID.
async function listReceiptFiles() {
  const client = getClient();
  if (!client || !client.credentials?.access_token) {
    throw new Error("Not authenticated. Sign in with the authorized Google account first.");
  }
  const drive = google.drive({ version: "v3", auth: client });
  const folder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const q = [
    "trashed = false",
    "(mimeType = 'application/pdf' or mimeType contains 'image/')",
    "(name contains 'receipt' or name contains 'invoice' or name contains 'bill' or name contains 'expense' or name contains 'order' or name contains 'statement' or name contains 'payment' or name contains 'purchase' or name contains 'tax' or name contains 'charge' or name contains 'statement')",
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

module.exports = { loadCreds, getClient, authUrl, exchangeCode, saveTokens, getProfile, listReceiptFiles, downloadFile, TOKEN_PATH, redirectUri };
