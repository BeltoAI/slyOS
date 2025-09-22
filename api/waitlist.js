const { MongoClient } = require("mongodb");

let cached = global.__mongoCache;
if (!cached) cached = global.__mongoCache = { client: null, db: null };

async function getDb() {
  if (cached.db) return cached.db;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "slyos";
  if (!uri) throw new Error("Missing MONGODB_URI");
  const client = new MongoClient(uri, { maxPoolSize: 3 });
  await client.connect();
  cached.client = client;
  cached.db = client.db(dbName);
  return cached.db;
}

function send(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
  // CORS (same-origin safe; allow OPTIONS for sanity)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return send(res, 204, {});

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8") || "{}";
    let body;
    try { body = JSON.parse(raw); } catch {
      return send(res, 400, { ok: false, error: "Invalid JSON" });
    }

    const email = String(body.email || "").trim().toLowerCase();
    const audience = String(body.audience || "company").trim().toLowerCase();
    const org = String(body.org || "").trim();

    // Basic validation
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) return send(res, 400, { ok: false, error: "Invalid email" });
    if (!["company", "app", "individual", "personal"].includes(audience)) {
      return send(res, 400, { ok: false, error: "Invalid audience" });
    }

    const db = await getDb();
    const col = db.collection("waitlist");

    // upsert by email
    const doc = {
      email,
      audience: audience === "app" ? "individual" : audience,
      org: org || null,
      ts: new Date(),
      ua: req.headers["user-agent"] || null,
      ip: (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim()
    };

    await col.updateOne({ email }, { $set: doc }, { upsert: true });

    return send(res, 200, { ok: true, saved: { email, audience: doc.audience, org: doc.org } });
  } catch (err) {
    console.error(err);
    return send(res, 500, { ok: false, error: "Server error" });
  }
};
