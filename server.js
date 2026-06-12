require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

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
  if (!MONGO_URI) {
    console.log('⚠️  No MONGO_URI found, using local file fallback');
    return false;
  }
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');
    return true;
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    return false;
  }
}

// ── Local file fallback (for development) ─────────────────────
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');

function loadLocal() {
  if (!fs.existsSync(DATA_FILE)) return { debts: [], bets: [], dId: 1, bId: 1 };
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function saveLocal(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Routes ─────────────────────────────────────────────────────
app.get('/api/data', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      let doc = await Store.findOne({ key: 'main' });
      if (!doc) doc = await Store.create({ key: 'main' });
      return res.json({ debts: doc.debts, bets: doc.bets, dId: doc.dId, bId: doc.bId });
    }
    res.json(loadLocal());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data', async (req, res) => {
  try {
    const { debts, bets, dId, bId } = req.body;
    if (mongoose.connection.readyState === 1) {
      await Store.findOneAndUpdate(
        { key: 'main' },
        { debts, bets, dId, bId },
        { upsert: true, new: true }
      );
      return res.json({ ok: true });
    }
    saveLocal({ debts, bets, dId, bId });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Debt Tracker running at http://localhost:${PORT}\n`);
  });
});
