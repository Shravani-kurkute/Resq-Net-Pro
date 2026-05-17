const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { initFirebase } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Firebase ───────────────────────────────────────────
initFirebase();

// ── Security ───────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// ── Rate limiting on all API routes ───────────────────
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

// ── Body parsing ──────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static frontend ───────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── API Routes ────────────────────────────────────────
app.use('/api/stat', apiLimiter, require('./routes/stat'));
app.use('/api/sos', apiLimiter, require('./routes/sos'));
app.use('/api/contact', apiLimiter, require('./routes/contact'));
app.use('/api/cases', apiLimiter, require('./routes/cases'));
app.use('/api/broadcast', apiLimiter, require('./routes/broadcast'));

// ── SPA fallback ──────────────────────────────────────
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Start ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀 ResQNet server → http://localhost:${PORT}`);
    console.log(`   API endpoints: /api/stat  /api/sos  /api/contact  /api/cases  /api/broadcast`);
});
