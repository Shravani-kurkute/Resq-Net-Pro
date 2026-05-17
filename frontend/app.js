// ══════════════════════════════════════════════════════
// ResQNet Frontend App — Full Featured Version
// ══════════════════════════════════════════════════════

const API = '';
let mapInstance = null;
let currentUser = JSON.parse(localStorage.getItem('rqUser') || 'null');
let auditLog = JSON.parse(localStorage.getItem('rqAudit') || '[]');

// ── Helpers ───────────────────────────────────────────
function el(id) { return document.getElementById(id); }
function qs(sel, ctx) { return (ctx || document).querySelector(sel); }

async function apiFetch(path, opts = {}) {
    try {
        const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
        return await res.json();
    } catch (e) { return { success: false, error: e.message }; }
}

function showToast(msg, type = '') {
    const t = el('toast'); if (!t) return;
    t.innerHTML = msg; t.className = 'toast ' + type;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 4000);
}

function timeAgo(isoStr) {
    if (!isoStr) return '—';
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
}

function statusBadge(status) {
    const map = { Pending: 'pending', Active: 'active', 'En Route': 'enroute', Resolved: 'resolved', critical: 'critical', info: 'info', warning: 'active' };
    return `<span class="badge badge-${map[status] || 'pending'}">${status}</span>`;
}
function caseTypeIcon(t) { return ({ Flood: '🌊', Fire: '🔥', Medical: '🏥', Cyclone: '🌀', Earthquake: '🌍', Other: '🆘' })[t] || '🆘'; }
function caseIconBg(t) { return ({ Flood: 'rgba(33,150,243,0.15)', Fire: 'rgba(255,87,34,0.15)', Medical: 'rgba(76,175,80,0.15)', Cyclone: 'rgba(156,39,176,0.15)', Earthquake: 'rgba(255,152,0,0.15)' })[t] || 'rgba(211,47,47,0.15)'; }

function pushAudit(action) {
    auditLog.unshift({ action, time: new Date().toISOString() });
    if (auditLog.length > 50) auditLog.pop();
    localStorage.setItem('rqAudit', JSON.stringify(auditLog));
    if (el('audit-list')) renderAuditLog();
}

// ── Auth / User System ────────────────────────────────
const DEMO_ACCOUNTS = {
    citizen: { name: 'Rahul Sharma', role: 'citizen', avatar: 'R', email: 'citizen@demo.com' },
    volunteer: { name: 'Priya Nair', role: 'volunteer', avatar: 'P', email: 'volunteer@demo.com' },
    ngo: { name: 'Asha Foundation', role: 'ngo', avatar: 'A', email: 'ngo@demo.com' },
    admin: { name: 'Admin Control', role: 'admin', avatar: 'X', email: 'admin@demo.com' },
};

function loginAs(role) {
    currentUser = DEMO_ACCOUNTS[role];
    localStorage.setItem('rqUser', JSON.stringify(currentUser));
    updateNavForUser();
    const dest = { citizen: 'citizen', volunteer: 'volunteer', ngo: 'ngo', admin: 'admin' }[role];
    showPage(dest);
    showToast(`✅ Logged in as ${currentUser.name}`, 'success');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('rqUser');
    updateNavForUser();
    showPage('home');
    showToast('Logged out successfully.');
}

function handleAuthLogin() {
    const email = el('auth-email').value.trim();
    const pass = el('auth-pass').value.trim();
    const role = el('auth-role').value;
    if (!email || !pass || !role) { showToast('⚠️ Fill in all fields', 'error'); return; }
    // Demo: accept any credentials with a selected role
    loginAs(role);
}

function handleRegister() {
    const name = el('reg-name').value.trim();
    const email = el('reg-email').value.trim();
    const pass = el('reg-pass').value.trim();
    const role = el('reg-role').value;
    if (!name || !email || !pass || !role) { showToast('⚠️ Fill in all fields', 'error'); return; }
    // In real app: Firebase createUserWithEmailAndPassword then set role in Firestore
    currentUser = { name, role, avatar: name[0].toUpperCase(), email };
    localStorage.setItem('rqUser', JSON.stringify(currentUser));
    updateNavForUser();
    const dest = { citizen: 'citizen', volunteer: 'volunteer', ngo: 'ngo', admin: 'admin' }[role];
    showPage(dest);
    showToast(`✅ Registered! Welcome, ${name}.`, 'success');
}

function updateNavForUser() {
    const userEl = el('nav-user');
    if (!userEl) return;
    if (currentUser) {
        userEl.innerHTML = `<div class="nav-user-badge" onclick="showProfile()" title="View profile">
            <div class="nav-avatar">${currentUser.avatar}</div>
            <span>${currentUser.name}</span>
            <span style="font-size:11px;color:var(--grey)">▾</span>
        </div>`;
    } else {
        userEl.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="showPage('login')">Login</button>`;
    }
}

function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.toggle('active', p.id === 'auth-tab-' + tab));
}

// Protected dashboard pages that require login
const PROTECTED_PAGES = ['citizen', 'volunteer', 'ngo', 'admin'];
// Role → page mapping for redirect after login
let pendingPage = null;

function showPage(pageId) {
    // Auth guard for dashboard pages
    if (PROTECTED_PAGES.includes(pageId) && !currentUser) {
        pendingPage = pageId;
        // Pre-select the role on the login page
        const roleMap = { citizen: 'citizen', volunteer: 'volunteer', ngo: 'ngo', admin: 'admin' };
        showPage('login');
        setTimeout(() => {
            const roleEl = el('auth-role');
            if (roleEl && roleMap[pageId]) roleEl.value = roleMap[pageId];
            // Show a helpful message pointing to demo buttons
            showToast('\ud83d\udd10 Login required. Use the demo buttons to sign in instantly!', '');
        }, 300);
        return;
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = el('page-' + pageId);
    if (!page) return;
    page.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(triggerAnimations, 100);
    if (pageId === 'home') { loadHomeStats(); loadBroadcastsBanner(); }
    if (pageId === 'citizen') loadCitizenDash();
    if (pageId === 'volunteer') loadVolunteerDash();
    if (pageId === 'admin') loadAdminDash();
    if (pageId === 'ngo') loadNgoDash();
}

function scrollToSection(id) {
    showPage('home');
    setTimeout(() => { const e = el(id); if (e) e.scrollIntoView({ behavior: 'smooth' }); }, 150);
}
function toggleMenu() { el('mobileMenu').classList.toggle('open'); }

// ── Animations ────────────────────────────────────────
function triggerAnimations() {
    const obs = new IntersectionObserver(entries =>
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }), { threshold: 0.1 });
    document.querySelectorAll('.fade-up').forEach(e => { e.classList.remove('visible'); obs.observe(e); });
}

// ── HOME ──────────────────────────────────────────────
async function loadHomeStats() {
    const data = await apiFetch('/api/stat');
    if (!data.success) return;
    const d = data.data;
    if (el('stat-volunteers') && d.activeResponders) animateNum(el('stat-volunteers'), d.activeResponders);
    if (el('stat-incidents') && d.totalIncidents) animateNum(el('stat-incidents'), d.totalIncidents);
}

function animateNum(elRef, target) {
    let cur = 0;
    const step = target / 60;
    const t = setInterval(() => {
        cur = Math.min(cur + step, target);
        elRef.firstChild.textContent = Math.floor(cur).toLocaleString();
        if (cur >= target) clearInterval(t);
    }, 16);
}

async function loadBroadcastsBanner() {
    const res = await apiFetch('/api/broadcast');
    const bar = el('live-broadcast-bar');
    if (!bar || !res.success || !res.data.length) return;
    const crit = res.data.find(b => b.severity === 'critical');
    if (crit) {
        bar.innerHTML = `🚨 LIVE ALERT: ${crit.title} — ${crit.message}`;
        bar.style.display = 'block';
    }
}

// ── CONTACT FORM ──────────────────────────────────────
async function handleContactSubmit() {
    const firstName = el('cf-firstname').value.trim();
    const email = el('cf-email').value.trim();
    const message = el('cf-message').value.trim();
    if (!firstName || !email || !message) { showToast('⚠️ Name, Email and Message are required.', 'error'); return; }
    const btn = el('cf-submit');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Sending...';
    const res = await apiFetch('/api/contact', {
        method: 'POST', body: JSON.stringify({
            name: firstName + ' ' + (el('cf-lastname').value || ''),
            email, subject: el('cf-subject').value, message, type: el('cf-type').value
        })
    });
    btn.disabled = false; btn.textContent = 'Send Message →';
    if (res.success) {
        showToast('✅ ' + (res.message || 'Message sent!'), 'success');
        ['cf-firstname', 'cf-lastname', 'cf-email', 'cf-subject', 'cf-message'].forEach(id => { if (el(id)) el(id).value = ''; });
    } else { showToast('❌ ' + (res.error || 'Something went wrong.'), 'error'); }
}

// ── SOS FORM ──────────────────────────────────────────
let selectedSosType = '';

function selectSosType(type) {
    selectedSosType = type;
    document.querySelectorAll('.sos-type-btn').forEach(b => b.classList.toggle('selected', b.dataset.type === type));
}

async function getLocation() {
    const btn = el('sos-loc-btn');
    btn.innerHTML = '<span class="spinner"></span> Getting GPS...';
    if (!navigator.geolocation) { btn.textContent = '📍 GPS not supported'; return; }
    navigator.geolocation.getCurrentPosition(pos => {
        el('sos-location').value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
        btn.innerHTML = '✅ Location captured';
        // Update map if open
        if (mapInstance) { mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 13); }
    }, () => {
        btn.textContent = '📍 Auto-detect Location';
        showToast('GPS failed. Enter location manually.', 'error');
    });
}

async function handleSosSubmit() {
    if (!selectedSosType) { showToast('⚠️ Select emergency type first.', 'error'); return; }
    const location = el('sos-location').value.trim();
    if (!location) { showToast('⚠️ Enter your location.', 'error'); return; }
    const btn = el('sos-submit');
    btn.disabled = true;
    btn.innerHTML = '🚨 <span class="spinner"></span> Sending SOS...';
    const res = await apiFetch('/api/cases', {
        method: 'POST', body: JSON.stringify({
            type: selectedSosType, location, details: el('sos-details').value.trim(),
            contact: el('sos-contact').value.trim(), source: 'website'
        })
    });
    btn.disabled = false; btn.innerHTML = '🆘 SEND SOS — GET HELP NOW';
    if (res.success) {
        localStorage.setItem('lastSosId', res.id);
        localStorage.setItem('lastSosType', selectedSosType);
        localStorage.setItem('lastSosLocation', location);
        localStorage.setItem('lastSosTime', new Date().toISOString());
        showToast('🆘 SOS sent! Help is being dispatched.', 'success');
        setTimeout(() => showPage('citizen'), 2000);
    } else { showToast('❌ ' + (res.error || 'Failed to send.'), 'error'); }
}

// ── CITIZEN DASHBOARD ─────────────────────────────────
let citizenSafe = false;

async function loadCitizenDash() {
    renderBroadcasts('citizen-broadcast-list');
    loadRecentCases();
    initMap('citizen-map', true);
    await loadCitizenSosTracker();
}

async function loadCitizenSosTracker() {
    const sosPanel = el('citizen-sos-panel');
    if (!sosPanel) return;

    // Show loading spinner first
    el('cs-type').textContent = '…';
    el('cs-loc').textContent = '…';
    el('cs-time').textContent = '…';
    el('cs-assigned').textContent = '…';

    // Fetch all cases from API
    const caseData = await apiFetch('/api/cases');
    if (!caseData.success || !caseData.data || !caseData.data.length) {
        showEmptySosPanel(sosPanel); return;
    }

    // Priority: match saved SOS id first, then fall back to most recent active case
    const lastId = localStorage.getItem('lastSosId');
    let found = lastId ? caseData.data.find(c => c.id === lastId) : null;

    // If no match by id, pick the most recent non-resolved case
    if (!found) {
        found = caseData.data.find(c => c.status !== 'Resolved');
    }

    if (!found) {
        // All cases are resolved — show the latest one
        found = caseData.data[0];
    }

    if (!found) { showEmptySosPanel(sosPanel); return; }

    // Populate the info cards
    if (el('cs-type')) el('cs-type').textContent = found.type || '—';
    if (el('cs-loc')) el('cs-loc').textContent = found.location || '—';
    if (el('cs-time')) el('cs-time').textContent = timeAgo(found.timestamp);
    if (el('cs-assigned')) el('cs-assigned').textContent = found.assignedTo || 'Unassigned';
    if (el('cs-status')) el('cs-status').innerHTML = statusBadge(found.status);

    // Update the timeline progress bar
    updateSosTracker(found.status);
}

function showEmptySosPanel(sosPanel) {
    // Reset info fields
    ['cs-type', 'cs-loc', 'cs-time', 'cs-assigned'].forEach(id => { if (el(id)) el(id).textContent = '—'; });
    if (el('cs-status')) el('cs-status').innerHTML = '';
    // Reset all steps to inactive
    [0, 1, 2, 3].forEach(i => { const s = el('track-' + i); if (s) s.className = 'progress-step'; });
    // Show a subtle note that no active SOS was found below the tracker
    const note = el('citizen-sos-empty-note');
    if (!note) {
        const div = document.createElement('div');
        div.id = 'citizen-sos-empty-note';
        div.style.cssText = 'text-align:center;padding:18px 0 8px;color:var(--grey);font-size:13px';
        div.innerHTML = `📡 No active SOS found. <a href="#" onclick="showPage('sos');return false;" style="color:var(--red)">Send one now →</a>`;
        sosPanel.appendChild(div);
    }
}

function updateSosTracker(status) {
    // Map status → which step index is "active"
    // Steps:  0=Received/Pending  1=Active/Assigned  2=En Route  3=Resolved
    const statusMap = { 'Pending': 0, 'Active': 1, 'En Route': 2, 'Resolved': 3 };
    const idx = statusMap[status] !== undefined ? statusMap[status] : 0;
    [0, 1, 2, 3].forEach(i => {
        const stepEl = el('track-' + i);
        if (!stepEl) return;
        if (i < idx) stepEl.className = 'progress-step done';
        else if (i === idx) stepEl.className = 'progress-step active';
        else stepEl.className = 'progress-step';
    });
}

function markSafe() {
    citizenSafe = !citizenSafe;
    const btn = el('mark-safe-btn');
    if (citizenSafe) {
        btn.innerHTML = '✅ Marked SAFE'; btn.className = 'btn btn-green';
        el('safe-status-display').innerHTML = `<div class="safe-badge-big">✅ YOU ARE MARKED SAFE<br><small style="font-size:14px;font-weight:400">Broadcast to all rescue teams at ${new Date().toLocaleTimeString()}</small></div>`;
        showToast('✅ Your safety status broadcast to all teams!', 'success');
        pushAudit('Citizen marked themselves SAFE');
    } else {
        btn.innerHTML = '🟢 Mark Yourself Safe'; btn.className = 'btn btn-ghost';
        el('safe-status-display').innerHTML = '';
    }
}

// ── BROADCASTS (shared renderer) ──────────────────────
let broadcastCache = [];

async function renderBroadcasts(targetId) {
    const listEl = el(targetId);
    if (!listEl) return;
    if (!broadcastCache.length) {
        listEl.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
        const res = await apiFetch('/api/broadcast');
        broadcastCache = (res.success && res.data) ? res.data : [];
    }
    if (!broadcastCache.length) {
        listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📢</div><p>No active broadcasts.</p></div>'; return;
    }
    listEl.innerHTML = broadcastCache.map(b => `
    <div class="broadcast-item ${b.severity === 'critical' ? 'broadcast-critical' : ''}">
      <div class="broadcast-icon">${b.severity === 'critical' ? '🚨' : b.severity === 'warning' ? '⚠️' : 'ℹ️'}</div>
      <div style="flex:1">
        <div class="broadcast-title">${b.title}</div>
        <div class="broadcast-msg">${b.message}</div>
        <div class="broadcast-meta">${statusBadge(b.severity)} · ${timeAgo(b.createdAt)} · ${b.createdBy}</div>
      </div>
    </div>`).join('');
}

async function refreshBroadcasts(targetId) {
    broadcastCache = [];
    await renderBroadcasts(targetId);
}

async function loadRecentCases() {
    const res = await apiFetch('/api/cases/recent');
    const list = el('recent-cases-list');
    if (!list) return;
    const cases = Array.isArray(res) ? res : (res.data || []);
    if (!cases.length) { list.innerHTML = '<div class="empty-state"><p>No recent cases.</p></div>'; return; }
    list.innerHTML = cases.map(c => `
    <div class="case-item">
      <div class="case-icon" style="background:${caseIconBg(c.type)}">${caseTypeIcon(c.type)}</div>
      <div class="case-info"><div class="case-type">${c.type} Emergency</div><div class="case-location">📍 ${c.location}</div><div class="case-time">${timeAgo(c.timestamp)}</div></div>
      ${statusBadge(c.status)}
    </div>`).join('');
}

// ── MAP (Leaflet.js) ──────────────────────────────────
const MOCK_INCIDENTS = [
    { lat: 21.1458, lng: 79.0882, type: 'Flood', title: 'Flood — Sector 4', status: 'Pending', location: 'Nagpur' },
    { lat: 18.5204, lng: 73.8567, type: 'Medical', title: 'Medical — Elderly Fall', status: 'Resolved', location: 'Pune' },
    { lat: 19.0760, lng: 72.8777, type: 'Fire', title: 'Fire — Industrial Zone', status: 'Active', location: 'Mumbai' },
    { lat: 12.9716, lng: 77.5946, type: 'Cyclone', title: 'Cyclone Alert', status: 'Pending', location: 'Bengaluru' },
    { lat: 28.7041, lng: 77.1025, type: 'Earthquake', 'title': 'Tremors Reported', status: 'Active', location: 'Delhi' },
];

const MARKER_COLORS = { Flood: '#2196F3', Fire: '#FF5722', Medical: '#4CAF50', Cyclone: '#9C27B0', Earthquake: '#FF9800', Other: '#D32F2F' };

function initMap(containerId, addIncidents = true) {
    const container = el(containerId);
    if (!container || !window.L) return;
    if (container._map) { container._map.invalidateSize(); return; }
    const map = L.map(containerId, { scrollWheelZoom: false }).setView([20.5937, 78.9629], 5);
    container._map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(map);
    if (addIncidents) {
        MOCK_INCIDENTS.forEach(inc => {
            const color = MARKER_COLORS[inc.type] || '#D32F2F';
            const icon = L.divIcon({
                html: `<div style="background:${color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${caseTypeIcon(inc.type)}</div>`,
                className: '', iconSize: [32, 32], iconAnchor: [16, 16]
            });
            L.marker([inc.lat, inc.lng], { icon }).addTo(map)
                .bindPopup(`<strong>${inc.title}</strong><br>📍 ${inc.location}<br>${statusBadge(inc.status)}`);
        });
    }
    setTimeout(() => map.invalidateSize(), 300);
    mapInstance = map;
    return map;
}

// ── VOLUNTEER DASHBOARD ───────────────────────────────
let volunteerStatus = 'Free';

async function loadVolunteerDash() {
    renderBroadcasts('vol-broadcast-list');
    initMap('vol-map', true);
    const res = await apiFetch('/api/cases');
    const tasks = el('vol-tasks');
    if (!tasks || !res.success) return;
    const myTasks = res.data.filter(c => c.status !== 'Resolved').slice(0, 5);
    if (!myTasks.length) {
        tasks.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No tasks assigned</h3><p>You\'re all caught up!</p></div>'; return;
    }
    tasks.innerHTML = myTasks.map(c => `
    <div class="case-item" id="task-${c.id}">
      <div class="case-icon" style="background:${caseIconBg(c.type)}">${caseTypeIcon(c.type)}</div>
      <div class="case-info">
        <div class="case-type">${c.type} — ${c.location}</div>
        <div class="case-location">${c.details || 'No details'}</div>
        <div class="case-time">${timeAgo(c.timestamp)}</div>
      </div>
      <div class="case-actions">
        ${c.status === 'Pending' ? `<button class="btn btn-orange btn-sm" onclick="volUpdateCase('${c.id}','Active')">Accept</button>` : ''}
        ${c.status === 'Active' ? `<button class="btn btn-blue btn-sm" onclick="volUpdateCase('${c.id}','En Route')">En Route</button>` : ''}
        ${c.status === 'En Route' ? `<button class="btn btn-green btn-sm" onclick="volUpdateCase('${c.id}','Resolved')">✓ Done</button>` : ''}
        ${statusBadge(c.status)}
      </div>
    </div>`).join('');
    // update stats
    if (el('vol-stat-active')) el('vol-stat-active').textContent = myTasks.filter(t => t.status === 'Active' || t.status === 'En Route').length;
    if (el('vol-stat-pending')) el('vol-stat-pending').textContent = myTasks.filter(t => t.status === 'Pending').length;
    if (el('vol-stat-resolved')) el('vol-stat-resolved').textContent = res.data.filter(t => t.status === 'Resolved').length;
}

async function volUpdateCase(id, status) {
    const res = await apiFetch('/api/cases/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (res.success) {
        showToast(`✅ Task marked as ${status}`, 'success');
        loadVolunteerDash();
    } else { showToast('❌ ' + (res.error || 'Update failed'), 'error'); }
}

function toggleVolunteerStatus(status) {
    volunteerStatus = status;
    document.querySelectorAll('.status-toggle-btn').forEach(b => {
        b.className = 'status-toggle-btn' + (b.dataset.status === status ? ` active-${status.toLowerCase()}` : '');
    });
    if (el('vol-status-label')) el('vol-status-label').innerHTML = `<span class="badge badge-${status === 'Free' ? 'resolved' : 'pending'}">${status}</span>`;
    showToast(`Status set to ${status}`, 'success');
}

// ── NGO DASHBOARD ─────────────────────────────────────
const NGO_INVENTORY = [
    { id: 'n1', item: 'Food Packets', icon: '🍱', stock: 850, unit: 'packets', threshold: 200, dispatched: 340 },
    { id: 'n2', item: 'Water Cans (20L)', icon: '💧', stock: 120, unit: 'cans', threshold: 50, dispatched: 80 },
    { id: 'n3', item: 'Medical Kits', icon: '🩺', stock: 45, unit: 'kits', threshold: 20, dispatched: 22 },
    { id: 'n4', item: 'Blankets', icon: '🛏️', stock: 220, unit: 'pieces', threshold: 60, dispatched: 130 },
    { id: 'n5', item: 'Tents', icon: '⛺', stock: 18, unit: 'units', threshold: 10, dispatched: 12 },
    { id: 'n6', item: 'Rescue Boats', icon: '🚤', stock: 4, unit: 'boats', threshold: 2, dispatched: 3 },
];

const NGO_HISTORY = [
    { date: new Date(Date.now() - 3600000).toISOString(), item: 'Food Packets', qty: 50, location: 'Nagpur Flood Site', status: 'Delivered' },
    { date: new Date(Date.now() - 7200000).toISOString(), item: 'Water Cans', qty: 20, location: 'Sector 4 Camp', status: 'In Transit' },
    { date: new Date(Date.now() - 86400000).toISOString(), item: 'Medical Kits', qty: 10, location: 'Pune Medical Center', status: 'Delivered' },
    { date: new Date(Date.now() - 172800000).toISOString(), item: 'Tents', qty: 5, location: 'Relief Camp A', status: 'Delivered' },
];

function loadNgoDash() {
    renderInventory();
    renderDispatchHistory();
    renderNgoStats();
}

function renderInventory() {
    const grid = el('ngo-inventory');
    if (!grid) return;
    grid.innerHTML = NGO_INVENTORY.map(item => {
        const pct = Math.min(100, (item.stock / (item.stock + item.dispatched)) * 100).toFixed(0);
        const low = item.stock < item.threshold;
        return `
        <div class="inventory-card ${low ? 'inventory-low' : ''}">
          <div class="inventory-header">
            <span class="inventory-icon">${item.icon}</span>
            <div>
              <div class="inventory-name">${item.item}</div>
              ${low ? '<span class="badge badge-critical">LOW STOCK</span>' : '<span class="badge badge-resolved">OK</span>'}
            </div>
          </div>
          <div class="inventory-stock">${item.stock.toLocaleString()} <span style="font-size:14px;color:var(--grey)">${item.unit}</span></div>
          <div class="stock-bar-track"><div class="stock-bar-fill" style="width:${pct}%;background:${low ? 'var(--red)' : 'var(--green)'}"></div></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--grey);margin-top:4px">
            <span>Dispatched: ${item.dispatched}</span><span>Min: ${item.threshold}</span>
          </div>
          <div class="inventory-actions">
            <button class="btn btn-green btn-sm" onclick="dispatchItem('${item.id}')">📦 Dispatch</button>
            <button class="btn btn-ghost btn-sm" onclick="restockItem('${item.id}')">+ Restock</button>
          </div>
        </div>`;
    }).join('');
}

function dispatchItem(id) {
    const item = NGO_INVENTORY.find(i => i.id === id);
    if (!item) return;
    const qty = parseInt(prompt(`Dispatch how many ${item.item}? (Stock: ${item.stock})`) || '0');
    if (!qty || qty <= 0) return;
    if (qty > item.stock) { showToast('❌ Not enough stock!', 'error'); return; }
    item.stock -= qty;
    item.dispatched += qty;
    const location = prompt('Dispatch to which location?') || 'Field Camp';
    NGO_HISTORY.unshift({ date: new Date().toISOString(), item: item.item, qty, location, status: 'In Transit' });
    renderInventory();
    renderDispatchHistory();
    renderNgoStats();
    pushAudit(`NGO dispatched ${qty} ${item.item} to ${location}`);
    showToast(`✅ Dispatched ${qty} ${item.item} to ${location}`, 'success');
}

function restockItem(id) {
    const item = NGO_INVENTORY.find(i => i.id === id);
    if (!item) return;
    const qty = parseInt(prompt(`Restock ${item.item} by how many?`) || '0');
    if (!qty || qty <= 0) return;
    item.stock += qty;
    renderInventory();
    renderNgoStats();
    pushAudit(`NGO restocked ${qty} ${item.item}`);
    showToast(`✅ Restocked ${qty} ${item.item}`, 'success');
}

function renderDispatchHistory() {
    const list = el('ngo-history');
    if (!list) return;
    list.innerHTML = NGO_HISTORY.map(h => `
    <div class="case-item">
      <div class="case-icon" style="background:rgba(76,175,80,0.15)">📦</div>
      <div class="case-info">
        <div class="case-type">${h.item} — ${h.qty} units</div>
        <div class="case-location">📍 ${h.location}</div>
        <div class="case-time">${timeAgo(h.date)}</div>
      </div>
      <span class="badge badge-${h.status === 'Delivered' ? 'resolved' : 'active'}">${h.status}</span>
    </div>`).join('');
}

function renderNgoStats() {
    const total = NGO_INVENTORY.reduce((s, i) => s + i.stock, 0);
    const disp = NGO_INVENTORY.reduce((s, i) => s + i.dispatched, 0);
    const low = NGO_INVENTORY.filter(i => i.stock < i.threshold).length;
    if (el('ngo-stat-total')) el('ngo-stat-total').textContent = total.toLocaleString();
    if (el('ngo-stat-disp')) el('ngo-stat-disp').textContent = disp.toLocaleString();
    if (el('ngo-stat-low')) el('ngo-stat-low').textContent = low;
    if (el('ngo-stat-active')) el('ngo-stat-active').textContent = NGO_HISTORY.filter(h => h.status === 'In Transit').length;
}

// ── ADMIN DASHBOARD ───────────────────────────────────
function switchAdminTab(tab) {
    el('admin-page').querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    el('admin-page').querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
    if (tab === 'sos') loadAdminPending();
    if (tab === 'cases') loadAdminCases();
    if (tab === 'analytics') loadAnalytics();
    if (tab === 'audit') renderAuditLog();
    if (tab === 'broadcast') { renderBroadcasts('broadcast-list-admin'); }
    if (tab === 'map') { setTimeout(() => initMap('admin-map', true), 100); }
}

async function loadAdminDash() {
    loadAdminPending();
    loadAnalytics();
}

async function loadAdminPending() {
    const res = await apiFetch('/api/cases');
    const list = el('admin-pending-list');
    if (!list || !res.success) return;
    const pending = res.data.filter(c => c.status === 'Pending');
    if (!pending.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div><h3>No pending cases</h3></div>'; return; }
    list.innerHTML = pending.map(c => `
    <div class="case-item">
      <div class="case-icon" style="background:${caseIconBg(c.type)}">${caseTypeIcon(c.type)}</div>
      <div class="case-info">
        <div class="case-type">${c.type} — ${c.location}</div>
        <div class="case-location">${c.details || ''} · 📞 ${c.contact || 'N/A'}</div>
        <div class="case-time">${timeAgo(c.timestamp)} · via ${c.source}</div>
      </div>
      <div class="case-actions">
        <button class="btn btn-blue btn-sm" onclick="assignCase('${c.id}')">Assign</button>
        <button class="btn btn-green btn-sm" onclick="adminUpdateCase('${c.id}','Active')">Activate</button>
        <button class="btn btn-red btn-sm" onclick="adminUpdateCase('${c.id}','Resolved')">Resolve</button>
      </div>
    </div>`).join('');
    if (el('an-total')) el('an-total').textContent = res.data.length;
    if (el('an-pending')) el('an-pending').textContent = pending.length;
}

async function loadAdminCases() {
    const res = await apiFetch('/api/cases');
    const list = el('admin-cases-list');
    if (!list || !res.success) return;
    list.innerHTML = res.data.map(c => `
    <div class="case-item">
      <div class="case-icon" style="background:${caseIconBg(c.type)}">${caseTypeIcon(c.type)}</div>
      <div class="case-info">
        <div class="case-type">${c.type} — ${c.location}</div>
        <div class="case-location">Assigned: ${c.assignedTo || 'None'} · ${c.source}</div>
        <div class="case-time">${timeAgo(c.timestamp)}</div>
      </div>
      <div class="case-actions">
        ${statusBadge(c.status)}
        ${c.status !== 'Resolved' ? `<select class="btn btn-sm btn-ghost" onchange="adminUpdateCase('${c.id}',this.value)" style="padding:4px 8px">
          <option value="">Change...</option><option>Pending</option><option>Active</option><option>En Route</option><option>Resolved</option>
        </select>` : ''}
      </div>
    </div>`).join('');
}

async function adminUpdateCase(id, status) {
    if (!status) return;
    const res = await apiFetch('/api/cases/' + id, { method: 'PATCH', body: JSON.stringify({ status }) });
    if (res.success) {
        showToast('✅ Case updated to ' + status, 'success');
        pushAudit(`Admin updated case ${id} → ${status}`);
        loadAdminPending(); loadAdminCases();
    } else { showToast('❌ ' + res.error, 'error'); }
}

async function assignCase(id) {
    const vols = ['Volunteer Priya', 'Volunteer Ravi', 'Volunteer Ananya', 'Volunteer Suresh'];
    const vol = prompt(`Assign to volunteer:\n${vols.map((v, i) => `${i + 1}. ${v}`).join('\n')}\n\nType name or number:`) || '';
    const name = vols[parseInt(vol) - 1] || vol;
    if (!name.trim()) return;
    const res = await apiFetch('/api/cases/' + id, { method: 'PATCH', body: JSON.stringify({ assignedTo: name, status: 'Active' }) });
    if (res.success) {
        showToast(`✅ Assigned to ${name}`, 'success');
        pushAudit(`Assigned case ${id} to ${name}`);
        loadAdminPending(); loadAdminCases();
    }
}

async function sendBroadcast() {
    const title = el('bc-title').value.trim(), message = el('bc-message').value.trim(), severity = el('bc-severity').value;
    if (!title || !message) { showToast('⚠️ Fill in title and message.', 'error'); return; }
    const btn = el('bc-submit');
    btn.disabled = true; btn.textContent = 'Sending...';
    const res = await apiFetch('/api/broadcast', { method: 'POST', body: JSON.stringify({ title, message, severity }) });
    btn.disabled = false; btn.textContent = '📢 Send Broadcast';
    if (res.success) {
        broadcastCache = [];  // clear cache so it re-fetches
        showToast('📢 Broadcast sent!', 'success');
        pushAudit(`Broadcast sent: "${title}"`);
        el('bc-title').value = el('bc-message').value = '';
        renderBroadcasts('broadcast-list-admin');
    } else { showToast('❌ ' + res.error, 'error'); }
}

async function loadAnalytics() {
    const [statRes, casesRes] = await Promise.all([apiFetch('/api/stat'), apiFetch('/api/cases')]);
    if (!statRes.success) return;
    const d = statRes.data;
    if (el('an-responders')) el('an-responders').textContent = d.activeResponders || 1250;
    if (el('an-saved')) el('an-saved').textContent = d.livesSaved || 8400;
    if (el('an-response')) el('an-response').textContent = (d.avgResponseTimeMin || '8.4') + ' min';
    if (!casesRes.success) return;
    const cases = casesRes.data;
    if (el('an-total2')) el('an-total2').textContent = cases.length;
    const pending = cases.filter(c => c.status === 'Pending').length;
    const active = cases.filter(c => c.status === 'Active' || c.status === 'En Route').length;
    const resolved = cases.filter(c => c.status === 'Resolved').length;
    if (el('an-pending')) el('an-pending').textContent = pending;
    if (el('an-active')) el('an-active').textContent = active;
    if (el('an-resolved')) el('an-resolved').textContent = resolved;
    // Type distribution bar chart
    const counts = {};
    cases.forEach(c => counts[c.type] = (counts[c.type] || 0) + 1);
    const max = Math.max(...Object.values(counts), 1);
    const colors = { Flood: '#2196F3', Fire: '#FF5722', Medical: '#4CAF50', Cyclone: '#9C27B0', Earthquake: '#FF9800', Other: '#D32F2F' };
    if (el('chart-bars')) el('chart-bars').innerHTML = Object.entries(counts).map(([type, count]) => `
    <div class="chart-bar-row">
      <div class="chart-bar-label">${caseTypeIcon(type)} ${type}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(count / max * 100).toFixed(0)}%;background:${colors[type] || '#D32F2F'}"></div></div>
      <div class="chart-bar-val">${count}</div>
    </div>`).join('');
    // Status donut substitute
    if (el('status-chart')) el('status-chart').innerHTML = `
    <div class="donut-row"><div class="donut-dot" style="background:var(--orange)"></div><span>Pending</span><strong>${pending}</strong></div>
    <div class="donut-row"><div class="donut-dot" style="background:var(--blue)"></div><span>Active</span><strong>${active}</strong></div>
    <div class="donut-row"><div class="donut-dot" style="background:var(--green)"></div><span>Resolved</span><strong>${resolved}</strong></div>`;
}

function renderAuditLog() {
    const list = el('audit-list');
    if (!list) return;
    if (!auditLog.length) { list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔒</div><h3>Audit Log</h3><p>Admin actions will appear here.</p></div>'; return; }
    list.innerHTML = auditLog.map(a => `
    <div class="audit-item"><div class="audit-dot"></div><div><div class="audit-text">${a.action}</div><div class="audit-time">${timeAgo(a.time)}</div></div></div>`).join('');
}

// ── AI CHATBOT ────────────────────────────────────────
const BOT_RESPONSES = {
    flood: '🌊 **Flood Emergency:**\n• Move to higher ground immediately\n• Do NOT walk through flood water\n• Turn off electricity at the mains\n• Call **NDRF: 011-24363260**\n• Use the SOS button in ResQNet',
    fire: '🔥 **Fire Emergency:**\n• Call **101** (Fire Brigade) immediately\n• Evacuate the building — do NOT use lifts\n• Stay low to avoid smoke inhalation\n• Use wet cloth over mouth/nose\n• Meet at your assembly point',
    medical: '🏥 **Medical Emergency:**\n• Call **108** (Ambulance) NOW\n• Do NOT move the injured unless in danger\n• Apply pressure to any bleeding wounds\n• Keep the person warm and calm\n• Use the SOS button to alert volunteers',
    cyclone: '🌀 **Cyclone/Storm:**\n• Move to a cyclone shelter immediately\n• Stock 3-day supply of water & food\n• Stay away from windows\n• Do NOT go outside during the eye\n• Follow NDMA guidelines',
    earthquake: '🌍 **Earthquake:**\n• DROP, COVER, HOLD ON\n• Stay away from windows & outer walls\n• If outdoors, move away from buildings\n• After shaking stops, check for injuries\n• Beware of aftershocks',
    sos: '🆘 **How to send SOS:**\n1. Click the red SOS button in the navbar\n2. Select your emergency type\n3. Grant location or type it manually\n4. Add any details about the situation\n5. Press SEND — help is dispatched in under 60 seconds!',
    help: '👋 **I can help with:**\n• How to send SOS\n• Flood / Fire / Medical / Cyclone / Earthquake guidance\n• How dashboards work\n• What ResQNet does\n\nJust type your query!',
    default: '🤖 I understand you need help. Try asking about:\n**flood, fire, medical, cyclone, earthquake, sos, dashboards**\n\nOr call the National Disaster Helpline: **1078**',
};

let chatOpen = false;

function toggleChatbot() {
    chatOpen = !chatOpen;
    el('chatbot-window').style.display = chatOpen ? 'flex' : 'none';
    if (chatOpen && !el('chat-messages').children.length) {
        appendBotMsg('👋 Hi! I\'m ResQNet\'s AI Emergency Assistant. I can guide you through any disaster situation. How can I help?');
    }
}

function appendBotMsg(text) {
    const msgs = el('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg bot-msg';
    div.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function appendUserMsg(text) {
    const msgs = el('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg user-msg';
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
}

function sendChatMessage() {
    const input = el('chat-input');
    const text = input.value.trim();
    if (!text) return;
    appendUserMsg(text);
    input.value = '';
    const lower = text.toLowerCase();
    let response = BOT_RESPONSES.default;
    if (lower.includes('flood')) response = BOT_RESPONSES.flood;
    else if (lower.includes('fire')) response = BOT_RESPONSES.fire;
    else if (lower.includes('medical') || lower.includes('ambulance') || lower.includes('injury')) response = BOT_RESPONSES.medical;
    else if (lower.includes('cyclone') || lower.includes('storm')) response = BOT_RESPONSES.cyclone;
    else if (lower.includes('earthquake') || lower.includes('tremor')) response = BOT_RESPONSES.earthquake;
    else if (lower.includes('sos') || lower.includes('help') || lower.includes('emergency')) response = BOT_RESPONSES.sos;
    else if (lower.includes('what') || lower.includes('how') || lower.includes('?')) response = BOT_RESPONSES.help;
    setTimeout(() => appendBotMsg(response), 600);
}

function handleChatKey(e) { if (e.key === 'Enter') sendChatMessage(); }

// ── Firebase Auth wrappers ────────────────────────────
async function handleAuthLogin() {
    const email = el('auth-email').value.trim();
    const pass = el('auth-pass').value.trim();
    const role = el('auth-role').value;
    if (!email || !pass || !role) { showToast('⚠️ Fill in all fields', 'error'); return; }
    const btn = document.querySelector('#auth-tab-login .btn-red');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Logging in...'; }
    let user = null;
    if (typeof firebaseLogin === 'function') user = await firebaseLogin(email, pass);
    if (btn) { btn.disabled = false; btn.textContent = 'Login →'; }
    if (user) {
        currentUser = { ...user, avatar: (user.name || 'U')[0].toUpperCase() };
        localStorage.setItem('rqUser', JSON.stringify(currentUser));
        updateNavForUser();
        const dest = { citizen: 'citizen', volunteer: 'volunteer', ngo: 'ngo', admin: 'admin' }[currentUser.role] || 'citizen';
        showPage(dest);
        showToast('✅ Welcome back, ' + currentUser.name + '!', 'success');
    } else {
        loginAs(role);  // demo fallback
    }
}

async function handleRegister() {
    const name = el('reg-name').value.trim();
    const email = el('reg-email').value.trim();
    const pass = el('reg-pass').value.trim();
    const role = el('reg-role').value;
    if (!name || !email || !pass || !role) { showToast('⚠️ Fill in all fields', 'error'); return; }
    const btn = document.querySelector('#auth-tab-register .btn-red');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Creating...'; }
    let user = null;
    if (typeof firebaseRegister === 'function') user = await firebaseRegister(email, pass, role, name);
    if (btn) { btn.disabled = false; btn.textContent = 'Create Account →'; }
    currentUser = user ? { ...user, avatar: name[0].toUpperCase() } : { name, role, avatar: name[0].toUpperCase(), email };
    localStorage.setItem('rqUser', JSON.stringify(currentUser));
    updateNavForUser();
    const dest = { citizen: 'citizen', volunteer: 'volunteer', ngo: 'ngo', admin: 'admin' }[role];
    showPage(dest);
    showToast('✅ Account created! Welcome, ' + name + '.', 'success');
}

// ── INIT ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // 1. Boot Firebase real-time connection
    if (typeof initFirebaseClient === 'function') initFirebaseClient();

    // 2. UI bootstrap
    triggerAnimations();
    loadHomeStats();
    updateNavForUser();
    loadBroadcastsBanner();

    // 3. Real-time Firestore listener — cases update across ALL dashboards
    if (typeof startRealtimeCasesListener === 'function') {
        startRealtimeCasesListener(() => {
            const active = document.querySelector('.page.active');
            if (!active) return;
            const pid = active.id;
            if (pid === 'page-citizen') loadCitizenDash();
            if (pid === 'page-volunteer') loadVolunteerDash();
            if (pid === 'page-admin') loadAdminPending();
        });
    }

    // 4. Real-time Firestore listener — broadcasts
    if (typeof startRealtimeBroadcastListener === 'function') {
        startRealtimeBroadcastListener(broadcasts => {
            broadcastCache = broadcasts;
            ['citizen-broadcast-list', 'vol-broadcast-list', 'broadcast-list-admin'].forEach(id => {
                if (el(id) && el(id).closest('.page.active')) renderBroadcasts(id);
            });
            const crit = broadcasts.find(b => b.severity === 'critical');
            const bar = el('live-broadcast-bar');
            if (bar && crit) { bar.innerHTML = '🚨 LIVE: ' + crit.title + ' — ' + crit.message; bar.style.display = 'block'; }
            else if (bar) bar.style.display = 'none';
        });
    }
});


// ══════════════════════════════════════════════════════
// SMART DISPATCH ENGINE — Nearest Volunteer Matching
// ══════════════════════════════════════════════════════

// Volunteer registry with real GPS coords, skills, and status
const VOLUNTEERS = [
    { id: 'v1', name: 'Priya Nair', avatar: 'P', lat: 21.1458, lng: 79.0882, status: 'Free', skills: ['Medical', 'Flood'], rating: 4.9, tasksCompleted: 34, phone: '+91 98765 11001' },
    { id: 'v2', name: 'Ravi Kumar', avatar: 'R', lat: 19.0760, lng: 72.8777, status: 'Free', skills: ['Fire', 'Rescue'], rating: 4.7, tasksCompleted: 22, phone: '+91 98765 11002' },
    { id: 'v3', name: 'Ananya Sharma', avatar: 'A', lat: 18.5204, lng: 73.8567, status: 'Busy', skills: ['Medical', 'Cyclone'], rating: 4.8, tasksCompleted: 41, phone: '+91 98765 11003' },
    { id: 'v4', name: 'Suresh Patil', avatar: 'S', lat: 28.7041, lng: 77.1025, status: 'Free', skills: ['Earthquake', 'Rescue'], rating: 4.6, tasksCompleted: 18, phone: '+91 98765 11004' },
    { id: 'v5', name: 'Divya Menon', avatar: 'D', lat: 12.9716, lng: 77.5946, status: 'Free', skills: ['Flood', 'Medical'], rating: 5.0, tasksCompleted: 56, phone: '+91 98765 11005' },
    { id: 'v6', name: 'Karan Mehta', avatar: 'K', lat: 22.5726, lng: 88.3639, status: 'Free', skills: ['Fire', 'Rescue'], rating: 4.5, tasksCompleted: 15, phone: '+91 98765 11006' },
];

// Haversine formula — distance in km between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA estimate (avg 40 km/h in disaster conditions)
function eta(distKm) {
    const mins = Math.round(distKm / 40 * 60);
    if (mins < 60) return mins + ' min';
    return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
}

// Skill match score: higher = better match for the incident type
function skillMatch(volunteer, incidentType) {
    return volunteer.skills.some(s => s.toLowerCase() === incidentType.toLowerCase()) ? 100 :
        volunteer.skills.some(s => ['Rescue', 'Medical'].includes(s)) ? 60 : 20;
}

// Compute score = skill(0-100) * 0.5 + proximity(0-100) * 0.5
function computeScore(vol, incidentLat, incidentLng, incidentType) {
    const dist = haversine(vol.lat, vol.lng, incidentLat, incidentLng);
    const maxDist = 5000; // ~india diameter
    const proxScore = Math.max(0, 100 - (dist / maxDist * 100));
    const sk = skillMatch(vol, incidentType);
    return { dist, score: (sk * 0.5 + proxScore * 0.5).toFixed(1), skillScore: sk };
}

// Current dispatch state
let dispatchCaseId = null;
let dispatchIncident = null;
let dispatchMap = null;
let dispatchRoutes = [];
let smartBestVolId = null;

function openSmartDispatch(caseId) {
    dispatchCaseId = caseId;
    el('dispatch-modal').style.display = 'flex';

    // Fetch case details
    apiFetch('/api/cases').then(res => {
        if (!res.success) return;
        const c = res.data.find(x => x.id === caseId);
        if (!c) return;
        dispatchIncident = c;

        // Use a default lat/lng if location is text (map center to India)
        const incLat = c.lat || 20.5937;
        const incLng = c.lng || 78.9629;

        el('dispatch-incident-info').innerHTML =
            `<strong style="color:var(--white)">${c.type} Emergency</strong> — 📍 ${c.location} · ${timeAgo(c.timestamp)}`;

        // Build volunteer rankings
        const available = VOLUNTEERS.filter(v => v.status !== 'Busy');
        const ranked = available.map(v => {
            const { dist, score, skillScore } = computeScore(v, incLat, incLng, c.type);
            return { ...v, dist, score: parseFloat(score), skillScore, etaStr: eta(dist) };
        }).sort((a, b) => b.score - a.score);

        smartBestVolId = ranked[0]?.id;

        // Render volunteer cards
        el('dispatch-volunteer-list').innerHTML = ranked.map((v, i) => `
        <div class="dispatch-vol-row ${i === 0 ? 'dispatch-vol-best' : ''}" id="dv-${v.id}">
          <div class="dispatch-vol-avatar">${v.avatar}</div>
          <div class="dispatch-vol-info">
            <div class="dispatch-vol-name">${v.name} ${i === 0 ? '<span class="dispatch-best-tag">🥇 BEST MATCH</span>' : ''}</div>
            <div class="dispatch-vol-skills">${v.skills.map(s => `<span class="dispatch-skill-tag">${s}</span>`).join('')}</div>
          </div>
          <div class="dispatch-vol-stats">
            <div class="dispatch-stat"><span class="dispatch-stat-num">${v.dist > 999 ? (v.dist / 1000).toFixed(1) + 'k' : v.dist.toFixed(0)}</span><span class="dispatch-stat-lbl">km away</span></div>
            <div class="dispatch-stat"><span class="dispatch-stat-num" style="color:var(--orange)">${v.etaStr}</span><span class="dispatch-stat-lbl">ETA</span></div>
            <div class="dispatch-stat"><span class="dispatch-stat-num" style="color:${v.skillScore === 100 ? 'var(--green)' : 'var(--grey)'}">${v.skillScore === 100 ? '✓ Match' : 'Partial'}</span><span class="dispatch-stat-lbl">Skill</span></div>
            <div class="dispatch-stat"><span class="dispatch-stat-num" style="color:var(--blue)">${v.score}</span><span class="dispatch-stat-lbl">Score</span></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="manualAssign('${v.id}','${v.name}')">Assign</button>
        </div>`).join('');

        // Build map
        buildDispatchMap(ranked, incLat, incLng, c.type);
    });
}

function buildDispatchMap(ranked, incLat, incLng, incidentType) {
    const container = el('dispatch-map');
    if (!container || !window.L) return;
    if (container._map) { container._map.remove(); container._map = null; }

    const map = L.map('dispatch-map').setView([incLat, incLng], 4);
    container._map = map;
    dispatchMap = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 18
    }).addTo(map);

    // Incident pin (red flashing)
    const incIcon = L.divIcon({
        html: `<div style="background:var(--red,#D32F2F);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 0 20px rgba(211,47,47,0.8);animation:pulse 1s infinite">${caseTypeIcon(incidentType)}</div>`,
        className: '', iconSize: [40, 40], iconAnchor: [20, 20]
    });
    L.marker([incLat, incLng], { icon: incIcon }).addTo(map)
        .bindPopup(`<strong>🆘 INCIDENT</strong><br>${incidentType} Emergency`).openPopup();

    // Volunteer pins + route lines
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722'];
    ranked.forEach((v, i) => {
        const color = i === 0 ? '#4CAF50' : colors[i] || '#888';
        const volIcon = L.divIcon({
            html: `<div style="background:${color};width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:white;border:2px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.4)">${v.avatar}</div>`,
            className: '', iconSize: [34, 34], iconAnchor: [17, 17]
        });
        L.marker([v.lat, v.lng], { icon: volIcon }).addTo(map)
            .bindPopup(`<strong>${v.name}</strong><br>📍 ${v.dist.toFixed(0)} km away<br>⏱️ ETA: ${v.etaStr}<br>Skills: ${v.skills.join(', ')}<br>Score: ${v.score}`);

        // Dashed route line from volunteer to incident
        const line = L.polyline([[v.lat, v.lng], [incLat, incLng]], {
            color, weight: i === 0 ? 3 : 1.5, opacity: i === 0 ? 0.9 : 0.4,
            dashArray: i === 0 ? '8 4' : '4 8'
        }).addTo(map);
        dispatchRoutes.push(line);
    });

    // Fit bounds to show all
    const allPoints = [[incLat, incLng], ...ranked.map(v => [v.lat, v.lng])];
    map.fitBounds(allPoints, { padding: [30, 30] });
    setTimeout(() => map.invalidateSize(), 200);
}

function closeDispatch() {
    el('dispatch-modal').style.display = 'none';
    dispatchRoutes = [];
    dispatchCaseId = null;
    dispatchIncident = null;
}

async function assignSmartPick() {
    if (!smartBestVolId || !dispatchCaseId) return;
    const vol = VOLUNTEERS.find(v => v.id === smartBestVolId);
    if (!vol) return;
    await manualAssign(vol.id, vol.name);
}

async function manualAssign(volId, volName) {
    if (!dispatchCaseId) return;
    const vol = VOLUNTEERS.find(v => v.id === volId);
    if (vol) vol.status = 'Busy'; // Mark as busy locally
    const res = await apiFetch('/api/cases/' + dispatchCaseId, {
        method: 'PATCH',
        body: JSON.stringify({ assignedTo: volName, status: 'Active' })
    });
    if (res.success) {
        showToast(`✅ ${volName} dispatched! ETA: ${vol?.etaStr || '—'}`, 'success');
        pushAudit(`Smart-dispatched ${volName} to case ${dispatchCaseId} (score: ${vol ? computeScore(vol, 20.5937, 78.9629, dispatchIncident?.type || '').score : '—'})`);
        closeDispatch();
        loadAdminPending();
        loadAdminCases();
    } else {
        showToast('❌ ' + res.error, 'error');
    }
}

// Override admin assignCase to use smart dispatch
function assignCase(id) {
    openSmartDispatch(id);
}

// ── Profile functions (referenced from HTML) ──────────
function showProfile() {
    if (!currentUser) { showPage('login'); return; }
    if (el('prof-avatar')) el('prof-avatar').textContent = currentUser.avatar || '?';
    if (el('prof-name')) el('prof-name').textContent = currentUser.name;
    if (el('prof-email')) el('prof-email').textContent = currentUser.email || '—';
    if (el('prof-role')) el('prof-role').textContent = currentUser.role;
    if (el('prof-name-input')) el('prof-name-input').value = currentUser.name;
    if (el('prof-email-input')) el('prof-email-input').value = currentUser.email || '';
    el('profile-modal').style.display = 'flex';
}

function closeProfile() { if (el('profile-modal')) el('profile-modal').style.display = 'none'; }

function saveProfile() {
    const name = el('prof-name-input').value.trim();
    const email = el('prof-email-input').value.trim();
    if (!name) { showToast('⚠️ Name cannot be empty', 'error'); return; }
    currentUser.name = name;
    currentUser.email = email;
    currentUser.avatar = name[0].toUpperCase();
    localStorage.setItem('rqUser', JSON.stringify(currentUser));
    updateNavForUser();
    closeProfile();
    showToast('✅ Profile updated!', 'success');
}

function profileLogout() {
    closeProfile();
    currentUser = null;
    localStorage.removeItem('rqUser');
    if (typeof stopAllListeners === 'function') stopAllListeners();
    updateNavForUser();
    showPage('home');
    showToast('Logged out.');
}

// ══════════════════════════════════════════════════════
// SIMULATE DISASTER — Live Hackathon Demo Feature
// ══════════════════════════════════════════════════════

const DEMO_SCENARIOS = [
    { type: 'Flood', location: 'Kolhapur, Maharashtra', lat: 16.7050, lng: 74.2433, details: 'Rising water levels. 3 families trapped on rooftop.' },
    { type: 'Fire', location: 'Dharavi, Mumbai', lat: 19.0380, lng: 72.8557, details: 'Industrial fire spreading. Evacuation needed.' },
    { type: 'Cyclone', location: 'Puri, Odisha', lat: 19.8135, lng: 85.8312, details: 'Category-3 cyclone landfall imminent. 500+ people at risk.' },
    { type: 'Earthquake', location: 'Bhuj, Gujarat', lat: 23.2420, lng: 69.6669, details: 'Magnitude 5.8 tremor. Building collapse reported.' },
    { type: 'Medical', location: 'Gadchiroli, Maharashtra', lat: 20.1809, lng: 79.9965, details: 'Mass casualty. 12 injured in road accident.' },
];

let simRunning = false;
let simCaseId = null;
let simInterval = null;

async function simulateDisaster() {
    if (simRunning) { showToast('⚠️ Simulation already running!', 'error'); return; }
    simRunning = true;

    // Pick random scenario
    const scenario = DEMO_SCENARIOS[Math.floor(Math.random() * DEMO_SCENARIOS.length)];

    // Show simulation overlay
    showSimBanner('🚨 SIMULATION STARTED — ' + scenario.type.toUpperCase() + ' IN ' + scenario.location.toUpperCase());

    // STEP 1: SOS received
    await sleep(500);
    showToast('📡 SOS RECEIVED — ' + scenario.type + ' @ ' + scenario.location, 'error');

    const res = await apiFetch('/api/cases', {
        method: 'POST',
        body: JSON.stringify({ type: scenario.type, location: scenario.location, details: scenario.details, contact: '+91 99999 00000', source: 'simulation' })
    });

    if (!res.success) { showToast('❌ Sim failed: ' + res.error, 'error'); simRunning = false; return; }
    simCaseId = res.id;

    // Switch to admin pending tab
    if (currentUser?.role === 'admin') {
        loadAdminPending();
        switchAdminTab('sos');
    }

    // STEP 2: Smart dispatch selects nearest volunteer
    await sleep(2500);
    showSimBanner('🤖 AI DISPATCH ENGINE — Calculating nearest volunteer...');
    showToast('🤖 Smart Dispatch: Analysing ' + VOLUNTEERS.filter(v => v.status !== 'Busy').length + ' available volunteers...', '');

    await sleep(2000);

    // Find best volunteer for this scenario
    const available = VOLUNTEERS.filter(v => v.status !== 'Busy');
    const ranked = available.map(v => {
        const dist = haversine(v.lat, v.lng, scenario.lat, scenario.lng);
        const sk = skillMatch(v, scenario.type);
        const score = sk * 0.5 + Math.max(0, 100 - dist / 50) * 0.5;
        return { ...v, dist, score };
    }).sort((a, b) => b.score - a.score);

    const best = ranked[0];
    if (!best) { simRunning = false; return; }

    showSimBanner('✅ MATCH FOUND — ' + best.name + ' · ' + best.dist.toFixed(0) + ' km away · ETA ' + eta(best.dist));
    showToast('✅ Best match: ' + best.name + ' (' + best.skills.join(', ') + ') — ' + best.dist.toFixed(0) + 'km away', 'success');

    // STEP 3: Dispatch volunteer
    await sleep(2500);
    showSimBanner('🚑 DISPATCHING — ' + best.name + ' is heading to ' + scenario.location);
    showToast('🚑 ' + best.name + ' dispatched! En route to ' + scenario.location, 'success');

    await apiFetch('/api/cases/' + simCaseId, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'En Route', assignedTo: best.name })
    });
    best.status = 'Busy';
    if (currentUser?.role === 'admin') { loadAdminPending(); loadAdminCases(); }

    // STEP 4: En Route progress
    await sleep(3000);
    showSimBanner('🗺️ EN ROUTE — ' + best.name + ' approaching incident zone...');
    showToast('📍 ' + best.name + ': "Arrived at staging area. Beginning rescue."', '');

    // STEP 5: Resolve
    await sleep(3500);
    showSimBanner('🟢 RESOLVED — Incident contained. All persons accounted for.');
    showToast('🟢 Case RESOLVED — ' + scenario.type + ' @ ' + scenario.location + ' handled in under 12 seconds!', 'success');

    await apiFetch('/api/cases/' + simCaseId, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Resolved' })
    });
    best.status = 'Free';
    if (currentUser?.role === 'admin') { loadAdminPending(); loadAdminCases(); loadAnalytics(); }

    pushAudit('SIMULATION: ' + scenario.type + ' @ ' + scenario.location + ' → dispatched ' + best.name + ' → RESOLVED');

    await sleep(2000);
    hideSimBanner();
    simRunning = false;
    simCaseId = null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function showSimBanner(msg) {
    let banner = el('sim-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sim-banner';
        banner.style.cssText = [
            'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
            'background:linear-gradient(135deg,#1a0000,#3a0000)',
            'border:2px solid var(--red)', 'border-radius:14px',
            'padding:14px 28px', 'z-index:990', 'text-align:center',
            'box-shadow:0 0 40px rgba(211,47,47,0.5)', 'min-width:340px', 'max-width:90vw',
            'font-weight:700', 'font-size:14px', 'color:white',
            'letter-spacing:0.5px', 'font-family:var(--font-head)', 'font-size:18px',
            'animation:simPulse 1.5s ease-in-out infinite'
        ].join(';');
        document.body.appendChild(banner);
        // Add animation
        const style = document.createElement('style');
        style.textContent = '@keyframes simPulse{0%,100%{box-shadow:0 0 40px rgba(211,47,47,0.5)}50%{box-shadow:0 0 80px rgba(211,47,47,0.9)}}';
        document.head.appendChild(style);
    }
    banner.textContent = msg;
    banner.style.display = 'block';
}

function hideSimBanner() {
    const banner = el('sim-banner');
    if (banner) banner.style.display = 'none';
}

// switchAdminTab is defined above near ADMIN DASHBOARD section (line ~601) — no duplicate needed

// ── Dropdown click-toggle (fixes hover gap bug) ────────
function toggleDashDropdown(e) {
    e.stopPropagation();
    const dd = el('nav-dash-dropdown');
    dd.classList.toggle('open');
}
function closeDashDropdown() {
    const dd = el('nav-dash-dropdown');
    if (dd) dd.classList.remove('open');
}
function navGoTo(page) {
    closeDashDropdown();
    showPage(page);
}
// Close dropdown when clicking anywhere outside
document.addEventListener('click', function (e) {
    const dd = el('nav-dash-dropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});
