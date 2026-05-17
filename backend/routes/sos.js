const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');

// GET /api/sos — health check
router.get('/', (req, res) => res.json({ status: 'SOS API ready' }));

// POST /api/sos — save SOS signal to Firestore
router.post('/', async (req, res) => {
    const { location, type, details, contactNumber } = req.body;

    if (!location || !type) {
        return res.status(400).json({ success: false, error: 'Missing required fields: location, type' });
    }

    const payload = {
        location,
        type,
        details: details || '',
        contactNumber: contactNumber || '',
        status: 'Pending',
        source: 'website',
        timestamp: new Date(),
    };

    console.log(`🆘 SOS received — ${type} at ${location}`);

    const db = getDb();
    if (db) {
        try {
            const ref = await db.collection('sos_requests').add(payload);
            return res.json({ success: true, id: ref.id, message: 'SOS signal received. Help is on the way.' });
        } catch (e) {
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // No Firebase — just acknowledge
    res.json({ success: true, message: 'SOS signal received. Help is on the way. (Firebase not configured)' });
});

module.exports = router;
