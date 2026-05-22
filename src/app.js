require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

const limiter = rateLimit({ windowMs: 15*60*1000, max: 500, message: { success: false, message: 'Too many requests.' } });
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { success: false, message: 'Too many auth attempts.' } });

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Wait for DB to be ready, then mount routes
async function startServer() {
  // Wait for DB initialization
  await require('./database/migrate');
  
  // Auto-seed on first run
  const seed = require('./database/seed');
  await seed();

  // API Routes
  app.use('/api/auth', authLimiter, require('./routes/auth'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/tasks', require('./routes/tasks'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'TaskFlow API running!', version: '1.0.0', timestamp: new Date().toISOString() });
  });

  // Serve frontend SPA for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    } else {
      res.status(404).json({ success: false, message: 'Route not found.' });
    }
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 TaskFlow running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
