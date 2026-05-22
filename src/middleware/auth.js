const jwt = require('jsonwebtoken');
const { getDb } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

exports.generateToken = (userId) => jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = await getDb();
    const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ success: false, message: 'Invalid token.' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

exports.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin role required.' });
  next();
};

exports.requireProjectAccess = async (req, res, next) => {
  const projectId = req.params.projectId || req.params.id || req.body.project_id;
  if (!projectId) return next();
  try {
    const db = await getDb();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ success: false, message: 'Project not found.' });
    const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, req.user.id);
    if (req.user.role === 'admin') { req.project = project; req.projectMember = member; return next(); }
    if (!member) return res.status(403).json({ success: false, message: 'Not a member of this project.' });
    req.project = project; req.projectMember = member;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

exports.requireProjectAdmin = (req, res, next) => {
  if (req.user.role === 'admin') return next();
  if (!req.projectMember || req.projectMember.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Project admin role required.' });
  }
  next();
};
