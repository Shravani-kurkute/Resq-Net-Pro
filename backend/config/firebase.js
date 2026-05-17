const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

let db;

function initFirebase() {
    if (admin.apps.length > 0) return admin.firestore();
    try {
        let credential;
        if (process.env.FIREBASE_KEY) {
            // Production (Render/cloud): key supplied as JSON string env var
            const key = JSON.parse(process.env.FIREBASE_KEY);
            credential = admin.credential.cert(key);
        } else {
            // Local dev: key file on disk
            const key = require(path.resolve(__dirname, './firebase-key.json'));
            credential = admin.credential.cert(key);
        }
        admin.initializeApp({ credential });
        db = admin.firestore();
        console.log('✅ Firebase connected');
    } catch (e) {
        console.warn('⚠️  Firebase key missing — using mock data. Error:', e.message);
    }
    return db;
}

module.exports = { initFirebase, getDb: () => db || null };
