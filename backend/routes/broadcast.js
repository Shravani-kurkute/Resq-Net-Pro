const express = require('express');
const router = express.Router();

// In-memory store for broadcasts (replaced by Firestore when key is present)
const { getDb } = require('../config/firebase');
const mockBroadcasts = [
    { id: '1', title: 'FLOOD ALERT — Nagpur', message: 'Avoid river areas in Sector 4-7. Evacuation underway.', severity: 'critical', createdAt: new Date(Date.now() - 3600000).toISOString(), createdBy: 'Admin' },
    { id: '2', title: 'Relief Camp Open', message: 'Civil Lines School open as relief camp. Food + shelter available.', severity: 'info', createdAt: new Date(Date.now() - 7200000).toISOString(), createdBy: 'Admin' },
];

// GET /api/broadcast — list all active broadcasts
router.get('/', async (req, res) => {
    const db = getDb();
    if (!db) return res.json({ success: true, data: mockBroadcasts });
    try {
        const snap = await db.collection('broadcasts')
            .orderBy('createdAt', 'desc').limit(10).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/broadcast — create a broadcast (admin only — add auth later)
router.post('/', async (req, res) => {
    const { title, message, severity = 'info' } = req.body;
    if (!title || !message) return res.status(400).json({ success: false, error: 'title and message are required' });

    const payload = { title, message, severity, createdAt: new Date().toISOString(), createdBy: 'Admin' };

    const db = getDb();
    if (!db) {
        mockBroadcasts.unshift({ id: Date.now().toString(), ...payload });
        return res.json({ success: true, data: payload });
    }
    try {
        const ref = await db.collection('broadcasts').add(payload);
        res.json({ success: true, id: ref.id, data: payload });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
