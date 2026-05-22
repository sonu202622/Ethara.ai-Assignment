const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database/db');
const { generateToken } = require('../middleware/auth');

const logActivity = async (db, userId, action, entityType, entityId, metadata = {}) => {
  try {
    db.prepare(`INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, action, entityType, entityId, JSON.stringify(metadata));
  } catch (e) {}
};

exports.signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { name, email, password } = req.body;
  try {
    const db = await getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) return res.status(409).json({ success: false, message: 'Email already registered.' });
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
    const assignedRole = adminCount.count === 0 ? 'admin' : 'member';
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`).run(name.trim(), email.toLowerCase(), hashedPassword, assignedRole);
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user.id);
    await logActivity(db, user.id, 'USER_REGISTERED', 'user', user.id, { name: user.name });
    res.status(201).json({ success: true, message: 'Account created.', data: { user, token } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  const { email, password } = req.body;
  try {
    const db = await getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    const token = generateToken(user.id);
    const { password: _, ...userWithoutPassword } = user;
    await logActivity(db, user.id, 'USER_LOGIN', 'user', user.id);
    res.json({ success: true, message: 'Login successful.', data: { user: userWithoutPassword, token } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

exports.getProfile = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

exports.updateProfile = async (req, res) => {
  const { name, avatar } = req.body;
  try {
    const db = await getDb();
    db.prepare('UPDATE users SET name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name || req.user.name, avatar || req.user.avatar, req.user.id);
    const updated = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, data: { user: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const db = await getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashed, req.user.id);
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const db = await getDb();
    const users = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users ORDER BY name').all();
    res.json({ success: true, data: { users } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
};
