// CI smoke test: boots the server, exercises REST CRUD + the graceful /scan
// path, then exits non-zero on any failure. Used by GitHub Actions and locally
// (`node scripts/smoke.js`).
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.SMOKE_PORT || 4123;
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  -> " + extra : ""}`);
};

const get = (p) => new Promise((res) => {
  const r = require("http").get(`http://localhost:${PORT}${p}`, (x) => {
    let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => res({ code: x.statusCode, body: b }));
  });
  r.on("error", () => res({ code: 0, body: "" }));
});
const post = (p, body) => new Promise((res) => {
  const data = JSON.stringify(body);
  const r = require("http").request(`http://localhost:${PORT}${p}`, { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (x) => {
    let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => res({ code: x.statusCode, body: b }));
  });
  r.on("error", () => res({ code: 0, body: "" })); r.write(data); r.end();
});
const put = (p, body) => new Promise((res) => {
  const data = JSON.stringify(body);
  const r = require("http").request(`http://localhost:${PORT}${p}`, { method: "PUT", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } }, (x) => {
    let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => res({ code: x.statusCode, body: b }));
  });
  r.on("error", () => res({ code: 0, body: "" })); r.write(data); r.end();
});
const del = (p) => new Promise((res) => {
  const r = require("http").request(`http://localhost:${PORT}${p}`, { method: "DELETE" }, (x) => {
    let b = ""; x.on("data", (d) => (b += d)); x.on("end", () => res({ code: x.statusCode, body: b }));
  });
  r.on("error", () => res({ code: 0, body: "" })); r.end();
});

(async () => {
  const srv = spawn("node", ["server.js"], { cwd: __dirname + "/..", env: { ...process.env, PORT: String(PORT) } });
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const c = await post("/api/receipts", { name: "Smoke", merchant: "X", total: 1, currency: "$" });
    check("POST /api/receipts -> 201", c.code === 201, "code=" + c.code);
    const id = JSON.parse(c.body).id;
    check("GET /api/receipts -> 200", (await get("/api/receipts")).code === 200);
    check("PUT /api/receipts/:id -> 200", (await put(`/api/receipts/${id}`, { category: "t" })).code === 200);
    check("DELETE /api/receipts/:id -> 204", (await del(`/api/receipts/${id}`)).code === 204);
    const h = await get("/healthz");
    check("GET /healthz -> 200 {ok:true}", h.code === 200 && /"ok":true/.test(h.body), "code=" + h.code);
    const sc = await post("/api/scan", {});
    check("POST /api/scan graceful without creds", sc.code === 500 && /Not authenticated/.test(sc.body), "code=" + sc.code);
  } finally {
    srv.kill();
    ["receipts.db", "receipts.db-wal", "receipts.db-shm"].forEach((f) => { try { fs.unlinkSync(path.join(__dirname, "..", f)); } catch {} });
    try { fs.rmSync(path.join(__dirname, "..", ".receipts"), { recursive: true, force: true }); } catch {}
  }
  console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
