// CI smoke test: boots the server, exercises REST CRUD + the graceful /scan
// path, then exits non-zero on any failure. Used by GitHub Actions and locally
// (`node scripts/smoke.js`).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");
const {
  SESSION_COOKIE_NAME,
  createSessionToken,
  createOAuthState,
  isValidOAuthState,
} = require("../src/web-auth");

const PORT = process.env.SMOKE_PORT || 4123;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
};

const request = (method, p, body, headers = {}) => new Promise((resolve) => {
  const data = body === undefined ? null : JSON.stringify(body);
  const requestHeaders = { ...headers };
  if (data !== null) {
    requestHeaders["Content-Type"] = "application/json";
    requestHeaders["Content-Length"] = Buffer.byteLength(data);
  }
  const r = http.request(`http://localhost:${PORT}${p}`, { method, headers: requestHeaders }, (x) => {
    let responseBody = "";
    x.on("data", (chunk) => (responseBody += chunk));
    x.on("end", () => resolve({ code: x.statusCode, body: responseBody, headers: x.headers }));
  });
  r.on("error", () => resolve({ code: 0, body: "", headers: {} }));
  if (data !== null) r.write(data);
  r.end();
});
const get = (p, headers) => request("GET", p, undefined, headers);
const post = (p, body, headers) => request("POST", p, body, headers);
const put = (p, body, headers) => request("PUT", p, body, headers);
const del = (p, headers) => request("DELETE", p, undefined, headers);
const TEST_SECRET = "smoke-test-google-client-secret";
const ownerHeaders = {
  Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken("owner@example.com", TEST_SECRET)}`,
};
const invalidSessionHeaders = {
  Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken("owner@example.com", "different-secret")}`,
};
const otherUserHeaders = {
  Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken("someone-else@example.com", TEST_SECRET)}`,
};
const expiredHeaders = {
  Cookie: `${SESSION_COOKIE_NAME}=${createSessionToken("owner@example.com", TEST_SECRET, Date.now() - 8 * 24 * 60 * 60 * 1000)}`,
};

const waitForServer = async (srv) => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (srv.exitCode !== null) throw new Error(`Server exited before becoming ready (code ${srv.exitCode})`);
    if ((await get("/healthz")).code === 200) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not become healthy within 15 seconds");
};

(async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "receipt-scanner-smoke-"));
  const srv = spawn("node", ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: path.join(testDir, "receipts.db"),
      RECEIPTS_DIR: path.join(testDir, ".receipts"),
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: TEST_SECRET,
      GOOGLE_ALLOWED_EMAIL: "owner@example.com",
      BASE_PATH: "",
    },
  });
  try {
    await waitForServer(srv);
    const state = createOAuthState(TEST_SECRET);
    check("OAuth state accepts the matching callback value", isValidOAuthState(state, state, TEST_SECRET));
    check("OAuth state rejects a mismatched callback value", !isValidOAuthState(state, `${state}x`, TEST_SECRET));
    check("OAuth state expires", !isValidOAuthState(state, state, TEST_SECRET, Date.now() + 11 * 60 * 1000));

    const home = await get("/");
    check("GET / redirects unauthenticated users", home.code === 302 && home.headers.location === "/auth", "code=" + home.code);
    check("GET /api/receipts rejects unauthenticated users", (await get("/api/receipts")).code === 401);
    check("POST /api/receipts rejects unauthenticated users", (await post("/api/receipts", { name: "Denied" })).code === 401);
    check("GET /api/receipts rejects an invalid session signature", (await get("/api/receipts", invalidSessionHeaders)).code === 401);
    check("GET /api/receipts rejects a different Google account", (await get("/api/receipts", otherUserHeaders)).code === 401);
    check("GET /api/receipts rejects an expired session", (await get("/api/receipts", expiredHeaders)).code === 401);

    check("GET / renders for the authorized account", (await get("/", ownerHeaders)).code === 200);
    check("GET /upload redirects unauthenticated users", (await get("/upload")).code === 302);
    check("GET /api/ocr-info requires an authorized account", (await get("/api/ocr-info")).code === 401);

    const c = await post("/api/receipts", { name: "Smoke", merchant: "X", total: 1, currency: "$" }, ownerHeaders);
    check("POST /api/receipts -> 201", c.code === 201, "code=" + c.code);
    const id = JSON.parse(c.body).id;
    check("GET /api/receipts -> 200", (await get("/api/receipts", ownerHeaders)).code === 200);
    check("PUT /api/receipts/:id -> 200", (await put(`/api/receipts/${id}`, { category: "t" }, ownerHeaders)).code === 200);
    check("DELETE /api/receipts/:id -> 204", (await del(`/api/receipts/${id}`, ownerHeaders)).code === 204);
    const h = await get("/healthz");
    check("GET /healthz -> 200 {ok:true}", h.code === 200 && /"ok":true/.test(h.body), "code=" + h.code);
    const model = await get("/api/ocr-info", ownerHeaders);
    check("GET /api/ocr-info reports local model", model.code === 200 && /Tesseract\.js English/.test(model.body) && /no per-page cloud charge/.test(model.body), "code=" + model.code);
    const translations = await get("/i18n.js");
    check("GET /i18n.js serves Hindi and Punjabi", translations.code === 200 && translations.body.includes("भाषा") && translations.body.includes("ਭਾਸ਼ਾ"), "code=" + translations.code);
    const prefixedTranslations = await get("/receipt/i18n.js");
    check("GET /receipt/i18n.js serves translations", prefixedTranslations.code === 200 && prefixedTranslations.body.includes("receiptLanguage"), "code=" + prefixedTranslations.code);
    check("POST /api/scan rejects unauthenticated users", (await post("/api/scan", {})).code === 401);
    const sc = await post("/api/scan", {}, ownerHeaders);
    check("POST /api/scan graceful without creds", sc.code === 500 && /Not authenticated/.test(sc.body), "code=" + sc.code);
  } finally {
    if (srv.exitCode === null) {
      srv.kill();
      await new Promise((resolve) => srv.once("exit", resolve));
    }
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
