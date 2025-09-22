const { MongoClient } = require('mongodb');

let cached = global._mongoCached;
if (!cached) cached = global._mongoCached = { client: null, db: null };

async function getDb() {
  if (cached.db) return cached.db;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'slyos';
  if (!uri) throw new Error('Missing MONGODB_URI');
  const client = new MongoClient(uri, { maxPoolSize: 3 });
  await client.connect();
  cached.client = client;
  cached.db = client.db(dbName);
  return cached.db;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try {
    const { email = '', audience = 'company', org = '' } = req.body || {};
    const emailNorm = String(email).trim().toLowerCase();
    const audNorm = String(audience).trim().toLowerCase();
    const orgNorm = String(org || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm))
      return res.status(400).json({ ok:false, error:'Invalid email' });
    const audMapped = audNorm === 'app' ? 'individual' : audNorm;
    if (!['company','individual','personal'].includes(audMapped))
      return res.status(400).json({ ok:false, error:'Invalid audience' });

    const db = await getDb();
    const col = db.collection('waitlist');
    const doc = {
      email: emailNorm,
      audience: audMapped,
      org: orgNorm || null,
      ts: new Date(),
      ua: req.headers['user-agent'] || null,
      ip: (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    };
    await col.updateOne({ email: emailNorm }, { $set: doc }, { upsert: true });
    return res.status(200).json({ ok:true, saved:{ email: emailNorm, audience: audMapped, org: doc.org } });
  } catch (err) {
    console.error('waitlist error:', err.message);
    return res.status(500).json({ ok:false, error:'Server error' });
  }
};
