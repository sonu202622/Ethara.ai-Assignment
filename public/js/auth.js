// API Base URL
const API_BASE = '/api';

// Auth helpers
const getToken = () => localStorage.getItem('token');
const getUser = () => JSON.parse(localStorage.getItem('user') || 'null');
const setAuth = (user, token) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); };
const clearAuth = () => { localStorage.removeItem('token'); localStorage.removeItem('user'); };
const isLoggedIn = () => !!getToken();

// Redirect if already logged in
if (isLoggedIn()) { window.location.href = '/dashboard.html'; }

// API helper
async function api(endpoint, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    },
    ...options
  });
  return res.json();
}

// Avatar color generator
function getAvatarColor(name) {
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899'];
  let hash = 0;
  for (let c of (name || '?')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// UI helpers
function showTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => { f.style.display = 'none'; f.classList.remove('active'); });
  document.getElementById(`${tab}Tab`).classList.add('active');
  document.getElementById(`${tab}Form`).style.display = 'flex';
}

function togglePassword(inputId) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function fillDemo(role) {
  if (role === 'admin') {
    document.getElementById('loginEmail').value = 'alice@taskmanager.io';
    document.getElementById('loginPassword').value = 'Admin@123';
  } else {
    document.getElementById('loginEmail').value = 'bob@taskmanager.io';
    document.getElementById('loginPassword').value = 'Member@123';
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.style.display = 'block';
}
function hideError(id) { document.getElementById(id).style.display = 'none'; }

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  const text = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  text.style.display = loading ? 'none' : 'inline';
  spinner.style.display = loading ? 'inline-flex' : 'none';
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  hideError('loginError');
  setLoading('loginBtn', true);

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.success) {
      setAuth(data.data.user, data.data.token);
      window.location.href = '/dashboard.html';
    } else {
      const msg = data.errors ? data.errors[0].msg : data.message;
      showError('loginError', msg);
    }
  } catch (err) {
    showError('loginError', 'Network error. Please try again.');
  } finally {
    setLoading('loginBtn', false);
  }
}

// Signup
async function handleSignup(e) {
  e.preventDefault();
  hideError('signupError');
  setLoading('signupBtn', true);

  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const role = document.getElementById('signupRole').value;

  try {
    const data = await api('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role })
    });

    if (data.success) {
      setAuth(data.data.user, data.data.token);
      window.location.href = '/dashboard.html';
    } else {
      const msg = data.errors ? data.errors[0].msg : data.message;
      showError('signupError', msg);
    }
  } catch (err) {
    showError('signupError', 'Network error. Please try again.');
  } finally {
    setLoading('signupBtn', false);
  }
}
