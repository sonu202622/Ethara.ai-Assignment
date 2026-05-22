// ─── Core Utilities ─────────────────────────────────────────────────────────
const API_BASE = '/api';
const getToken = () => localStorage.getItem('token');
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const setUser = (u) => localStorage.setItem('user', JSON.stringify(u));
const clearAuth = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };

// Guard: must be logged in
if (!getToken()) { window.location.href = '/'; }

// API wrapper
async function api(endpoint, options = {}) {
  const token = getToken();
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
      ...options
    });
    const data = await res.json();
    if (res.status === 401) { clearAuth(); window.location.href = '/'; }
    return data;
  } catch (err) {
    showToast('Network error. Please check your connection.', 'error');
    throw err;
  }
}

// Avatar helpers
function getAvatarColor(name) {
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6'];
  let h = 0; for (let c of (name||'?')) h = c.charCodeAt(0) + ((h<<5)-h);
  return colors[Math.abs(h) % colors.length];
}
function makeAvatar(name, cls='') {
  const initials = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const color = getAvatarColor(name);
  return `<div class="avatar ${cls}" style="background:${color}">${initials}</div>`;
}

// Toast notifications
let toastContainer;
function showToast(msg, type = 'info') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  toastContainer.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 4000);
}

// Modal helpers
function openModal(html, id='appModal') {
  closeModal(id);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = id;
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target===overlay) closeModal(id); });
  document.body.appendChild(overlay);
}
function closeModal(id='appModal') { const m = document.getElementById(id); if (m) m.remove(); }

// Dropdown toggle
function toggleDropdown(id) {
  const dd = document.getElementById(id);
  const isOpen = dd.style.display === 'block';
  document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display = 'none');
  dd.style.display = isOpen ? 'none' : 'block';
}
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown-menu').forEach(m => m.style.display='none');
});

// Format helpers
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function isOverdue(d, status) { return d && status !== 'done' && new Date(d) < new Date(); }
function daysUntil(d) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  return `${diff}d left`;
}

function priorityBadge(p) {
  return `<span class="priority-badge ${p}"><span class="priority-dot"></span>${p}</span>`;
}
function statusBadge(s) {
  const labels = {todo:'To Do',in_progress:'In Progress',review:'Review',done:'Done'};
  return `<span class="status-badge ${s}">${labels[s]||s}</span>`;
}

// Active nav
function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
}

// ─── Sidebar User Card ───────────────────────────────────────────────────────
function renderUserCard() {
  const user = getUser();
  const el = document.getElementById('sidebarUser');
  if (!el || !user) return;
  el.innerHTML = `
    ${makeAvatar(user.name)}
    <div class="user-info">
      <div class="user-name">${user.name}</div>
      <div class="user-role">${user.role === 'admin' ? '👑 Admin' : '👤 Member'}</div>
    </div>
    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
  `;
  el.onclick = () => toggleDropdown('userDropdown');
}

function logout() {
  clearAuth();
  window.location.href = '/';
}

// Mobile sidebar
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  const ov = document.getElementById('sidebarOverlay');
  if (ov) { ov.style.display = 'block'; }
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const ov = document.getElementById('sidebarOverlay');
  if (ov) { ov.style.display = 'none'; }
}

// ─── Admin-only visibility ───────────────────────────────────────────────────
function applyRoleVisibility() {
  const user = getUser();
  if (!user) return;
  document.querySelectorAll('[data-role="admin"]').forEach(el => {
    el.style.display = user.role === 'admin' ? '' : 'none';
  });
  document.querySelectorAll('[data-role="member"]').forEach(el => {
    el.style.display = user.role === 'member' ? '' : 'none';
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  renderUserCard();
  applyRoleVisibility();
});
