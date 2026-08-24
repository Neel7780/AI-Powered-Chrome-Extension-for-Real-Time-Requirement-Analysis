/**
 * Main Express Server
 * AI-Powered Real-Time Requirement Analysis & Evaluation Platform
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const analyzeRoutes = require('./routes/analyze');
const questionRoutes = require('./routes/questions');
const requirementRoutes = require('./routes/requirements');
const evaluateRoutes = require('./routes/evaluate');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/analyze', analyzeRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/evaluate', evaluateRoutes);
app.use('/api/export', exportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'AI Real-Time Requirement Analysis Platform',
    version: '1.0.0'
  });
});

// Serve web application frontend
app.use(express.static(path.join(__dirname, '../webapp')));

// Unknown API paths must answer with JSON, not the SPA shell, so client-side
// fetch().json() reports a real 404 instead of an opaque HTML parse error.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `Unknown API endpoint: ${req.method} /api${req.path}` });
});

// Fallback to webapp index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../webapp/index.html'));
});

// Start Server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 AI Requirement Analysis Server running on port ${PORT}`);
    console.log(`🌐 Web Dashboard & Meeting Studio: http://localhost:${PORT}`);
    console.log(`🔌 API Endpoints available at http://localhost:${PORT}/api`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
