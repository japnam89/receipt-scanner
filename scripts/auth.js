// One-time Google OAuth consent. Run `npm run auth`, open the printed URL,
// authorize, and you'll be redirected back to /oauth2callback which writes
// token.json. After that, `POST /api/scan` works.
require("dotenv").config();
const { authUrl } = require("../src/drive");
const open = (url) => {
  const { spawn } = require("child_process");
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try { spawn(cmd, [url]); } catch {}
};

try {
  const url = authUrl();
  console.log("\nOpen this URL in your browser to authorize Google Drive access:\n");
  console.log(url + "\n");
  console.log("(Attempting to open it automatically...)\n");
  open(url);
  console.log("After approving, you'll be redirected to /oauth2callback and the token will be saved.");
} catch (e) {
  console.error("Could not start auth:", e.message);
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}
