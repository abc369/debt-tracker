require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

app.use(cors());
app.use(express.json());

// ── Static files ───────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── MongoDB Schema ─────────────────────────────────────────────
const dataSchema = new mongoose.Schema({
  key:   { type: String, default: 'main' },
  debts: { type: Array,  default: [] },
  bets:  { type: Array,  default: [] },
  dId:   { type: Number, default: 1 },
  bId:   { type: Number, default: 1 },
});
const Store = mongoose.model('Store', dataSchema);

// ── Connect to MongoDB ─────────────────────────────────────────
async function connectDB() {
  if (!MONGO_URI) { console.log('⚠️  No MONGO_URI, using local file fallback'); return false; }
  try { await mongoose.connect(MONGO_URI); console.log('✅ MongoDB connected'); return true; }
  catch (err) { console.error('❌ MongoDB failed:', err.message); return false; }
}

// ── Local file fallback ────────────────────────────────────────
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');
function loadLocal() {
  if (!fs.existsSync(DATA_FILE)) return { debts: [], bets: [], dId: 1, bId: 1 };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveLocal(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }

// ── Auth middleware ────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token === `${ADMIN_USER}:${ADMIN_PASS}`) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Public API (read-only) ─────────────────────────────────────
app.get('/api/data', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let doc = await Store.findOne({ key: 'main' });
      if (!doc) doc = await Store.create({ key: 'main' });
      return res.json({ debts: doc.debts, bets: doc.bets, dId: doc.dId, bId: doc.bId });
    }
    res.json(loadLocal());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin API (write — requires token) ────────────────────────
app.post('/api/data', requireAdmin, async (req, res) => {
  try {
    const { debts, bets, dId, bId } = req.body;
    if (mongoose.connection.readyState === 1) {
      await Store.findOneAndUpdate({ key: 'main' }, { debts, bets, dId, bId }, { upsert: true, new: true });
      return res.json({ ok: true });
    }
    saveLocal({ debts, bets, dId, bId });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Admin login ────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true, token: `${ADMIN_USER}:${ADMIN_PASS}` });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ── Start ──────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => console.log(`\n🚀 Debt Tracker running at http://localhost:${PORT}\n`));
});
