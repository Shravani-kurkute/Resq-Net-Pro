// ══════════════════════════════════════════════════════
// Firebase Web SDK — Real-time Client for ResQNet
// Initializes Firestore + Auth (compat SDK via CDN)
// ══════════════════════════════════════════════════════

const firebaseConfig = {
    apiKey: "AIzaSyDGFyFHWXxMvnhvyQ-bSppI8ofbI-pujNE",
    authDomain: "resqnet-a972d.firebaseapp.com",
    projectId: "resqnet-a972d",
    storageBucket: "resqnet-a972d.firebasestorage.app",
    messagingSenderId: "660464280929",
    appId: "1:660464280929:web:f09290072831d86a549120"
};

// Initialise only once
let db = null;
let auth = null;
let fbReady = false;

function initFirebaseClient() {
    try {
        if (!firebase.apps || !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        fbReady = true;
        console.log('🔥 Firebase Web SDK connected — project: resqnet-a972d');
        // Enable offline persistence
        db.enablePersistence({ synchronizeTabs: true }).catch(e => {
            if (e.code !== 'failed-precondition' && e.code !== 'unimplemented')
                console.warn('Offline persistence:', e.message);
        });
    } catch (e) {
        console.warn('Firebase init error:', e.message, '— using API fallback');
        fbReady = false;
    }
}

function getFirestoreDB() { return fbReady ? db : null; }
function getFirebaseAuth() { return fbReady ? auth : null; }

// ── Firebase Auth helpers ─────────────────────────────
async function firebaseRegister(email, password, role, name) {
    if (!fbReady) return null;
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name });
        // Set role in Firestore
        await db.collection('users').doc(cred.user.uid).set({
            name, email, role, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { uid: cred.user.uid, name, email, role };
    } catch (e) {
        showToast('❌ ' + e.message, 'error');
        return null;
    }
}

async function firebaseLogin(email, password) {
    if (!fbReady) return null;
    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const snap = await db.collection('users').doc(cred.user.uid).get();
        const data = snap.exists ? snap.data() : {};
        return { uid: cred.user.uid, name: data.name || cred.user.displayName || email.split('@')[0], email, role: data.role || 'citizen' };
    } catch (e) {
        showToast('❌ ' + e.message, 'error');
        return null;
    }
}

// ── Real-time Firestore listeners ────────────────────
let casesListener = null;
let broadcastListener = null;

function startRealtimeCasesListener(onUpdate) {
    if (!fbReady || casesListener) return;
    casesListener = db.collection('sos_requests')
        .orderBy('timestamp', 'desc').limit(50)
        .onSnapshot(snap => {
            const cases = snap.docs.map(d => ({ id: d.id, ...d.data(), timestamp: d.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString() }));
            onUpdate(cases);
        }, e => {
            // permission-denied = Firestore not enabled yet, fall back to API silently
            if (e.code === 'permission-denied' || e.code === 'unimplemented') {
                console.info('Firestore not enabled — using API fallback (normal without service account)');
                fbReady = false;
                casesListener = null;
            } else {
                console.warn('Cases listener:', e.message);
            }
        });
    console.log('📡 Real-time cases listener started');
}

function startRealtimeBroadcastListener(onUpdate) {
    if (!fbReady || broadcastListener) return;
    broadcastListener = db.collection('broadcasts')
        .orderBy('createdAt', 'desc').limit(10)
        .onSnapshot(snap => {
            const broadcasts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            onUpdate(broadcasts);
        }, e => {
            if (e.code === 'permission-denied' || e.code === 'unimplemented') {
                console.info('Firestore broadcasts not enabled — API fallback active');
                fbReady = false;
                broadcastListener = null;
            } else {
                console.warn('Broadcast listener:', e.message);
            }
        });
    console.log('📡 Real-time broadcast listener started');
}

function stopAllListeners() {
    if (casesListener) { casesListener(); casesListener = null; }
    if (broadcastListener) { broadcastListener(); broadcastListener = null; }
}
