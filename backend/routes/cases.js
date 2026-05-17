const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');

// Mock in-memory cases
let mockCases = [
    { id: 'c1', type: 'Flood', location: 'Sector 4, Nagpur', status: 'Pending', contact: '9876543210', details: 'Water level rising', source: 'app', timestamp: new Date(Date.now() - 3600000).toISOString(), assignedTo: null },
    { id: 'c2', type: 'Fire', location: 'Industrial Zone', status: 'Active', contact: '9123456789', details: 'Factory fire', source: 'app', timestamp: new Date(Date.now() - 7200000).toISOString(), assignedTo: 'Volunteer A' },
    { id: 'c3', type: 'Medical', location: 'Sector 12, Pune', status: 'Resolved', contact: '9000000001', details: 'Elderly fall', source: 'website', timestamp: new Date(Date.now() - 86400000).toISOString(), assignedTo: 'Volunteer B' },
    { id: 'c4', type: 'Cyclone', location: 'Coastal Area, Konkan', status: 'Pending', contact: '9000000002', details: 'Roof damage', source: 'app', timestamp: new Date(Date.now() - 1800000).toISOString(), assignedTo: null },
    { id: 'c5', type: 'Medical', location: 'Dharavi, Mumbai', status: 'Active', contact: '9000000003', details: 'Multiple injured', source: 'website', timestamp: new Date(Date.now() - 900000).toISOString(), assignedTo: 'Volunteer C' },
];

// GET /api/cases — all cases
router.get('/', async (req, res) => {
    const db = getDb();
    if (!db) return res.json({ success: true, data: mockCases });
    try {
        const snap = await db.collection('sos_requests').orderBy('timestamp', 'desc').limit(50).get();
        res.json({ success: true, data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// GET /api/cases/recent — resolved cases
router.get('/recent', async (req, res) => {
    const db = getDb();
    if (!db) return res.json(mockCases.filter(c => c.status === 'Resolved'));
    try {
        const snap = await db.collection('sos_requests')
            .where('status', '==', 'Resolved')
            .orderBy('timestamp', 'desc').limit(5).get();
        res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PATCH /api/cases/:id — update status or assignedTo
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { status, assignedTo } = req.body;
    const allowed = ['Pending', 'Active', 'En Route', 'Resolved'];
    if (status && !allowed.includes(status))
        return res.status(400).json({ success: false, error: 'Invalid status value' });

    const db = getDb();
    if (!db) {
        const idx = mockCases.findIndex(c => c.id === id);
        if (idx === -1) return res.status(404).json({ success: false, error: 'Case not found' });
        if (status) mockCases[idx].status = status;
        if (assignedTo !== undefined) mockCases[idx].assignedTo = assignedTo;
        return res.json({ success: true, data: mockCases[idx] });
    }
    try {
        const update = {};
        if (status) update.status = status;
        if (assignedTo !== undefined) update.assignedTo = assignedTo;
        await db.collection('sos_requests').doc(id).update(update);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// POST /api/cases — new SOS case (same as sos route but under /cases too)
router.post('/', async (req, res) => {
    const { type, location, details, contact, source = 'website' } = req.body;
    if (!type || !location) return res.status(400).json({ success: false, error: 'type and location required' });

    const payload = { type, location, details: details || '', contact: contact || '', status: 'Pending', source, assignedTo: null, timestamp: new Date().toISOString() };

    const db = getDb();
    if (!db) {
        const newCase = { id: 'c' + Date.now(), ...payload };
        mockCases.unshift(newCase);
        return res.json({ success: true, id: newCase.id, data: newCase });
    }
    try {
        const ref = await db.collection('sos_requests').add(payload);
        res.json({ success: true, id: ref.id, data: payload });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;