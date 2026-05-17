const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');

// GET /api/stat — live stats from Firestore, or mock data
router.get('/', async (req, res) => {
    const db = getDb();
    if (!db) {
        return res.json({
            success: true,
            data: {
                activeResponders: 1250,
                livesSaved: 8400,
                avgResponseTimeMin: 8.4,
                totalIncidents: 3200,
            },
        });
    }
    try {
        const [respondersSnap, caseSnap] = await Promise.all([
            db.collection('responders').where('status', '==', 'active').get(),
            db.collection('sos_requests').where('status', '==', 'Resolved').get(),
        ]);
        res.json({
            success: true,
            data: {
                activeResponders: respondersSnap.size,
                livesSaved: caseSnap.size,
                totalIncidents: caseSnap.size,
            },
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
