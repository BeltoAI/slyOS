const path = require("path");
const fs = require("fs");
const express = require("express");
const { MongoClient } = require("mongodb");

/* --- minimal .env.local loader (no deps) --- */
(() => {
  const p = path.join(__dirname, ".env.local");
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_]\w*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
})();

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ---- middleware ----
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ---- local CORS ----
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ---- Mongo wiring ----
let mongo = { client: null, db: null };
async function getDb() {
  if (mongo.db) return mongo.db;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "slyos";
  if (!uri) throw new Error("Missing MONGODB_URI (set it in .env.local or env)");
  const client = new MongoClient(uri, { maxPoolSize: 3 });
  await client.connect();
  mongo.client = client;
  mongo.db = client.db(dbName);
  return mongo.db;
}

// ---- API: /api/waitlist ----
app.post("/api/waitlist", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const audienceRaw = String(req.body?.audience || "company").trim().toLowerCase();
    const audience = audienceRaw === "app" ? "individual" : audienceRaw;
    const org = String(req.body?.org || "").trim();

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return res.status(400).json({ ok: false, error: "Invalid email" });
    if (!["company", "individual", "personal"].includes(audience)) {
      return res.status(400).json({ ok: false, error: "Invalid audience" });
    }

    const db = await getDb();
    const col = db.collection("waitlist");
    const doc = {
      email,
      audience,
      org: org || null,
      ts: new Date(),
      ua: req.headers["user-agent"] || null,
      ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim()
    };

    await col.updateOne({ email }, { $set: doc }, { upsert: true });
    return res.json({ ok: true, saved: { email, audience, org: doc.org } });
  } catch (err) {
    console.error("waitlist error:", err.message);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
});

// ---- Static files ----
app.use(express.static(ROOT, { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(ROOT, "index.html")));

app.listen(PORT, () => {
  console.log(`SlyOS local server: http://localhost:${PORT}`);
});
