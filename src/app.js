const express = require('express');

const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Export routes
const exportRoutes = require('./routes/exports');
app.use('/exports', exportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.API_PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
