const express = require('express');
const router = express.Router();
const { startExport, cancelExport, getExportStatus, getExportFilePath } = require('../services/exportService');
const fs = require('fs');
const zlib = require('zlib');

// POST /exports/csv - Initiate export
router.post('/csv', async (req, res) => {
  try {
    const { country_code, subscription_tier, min_ltv, columns, delimiter, quoteChar } = req.query;
    
    const filters = {};
    if (country_code) filters.country_code = country_code;
    if (subscription_tier) filters.subscription_tier = subscription_tier;
    if (min_ltv) filters.min_ltv = min_ltv;

    const csvOptions = {};
    if (delimiter) csvOptions.delimiter = delimiter;
    if (quoteChar) csvOptions.quoteChar = quoteChar;

    const job = await startExport(filters, columns || null, csvOptions);

    res.status(202).json({
      exportId: job.exportId,
      status: job.status,
    });
  } catch (err) {
    console.error('Error initiating export:', err);
    res.status(500).json({ error: 'Failed to initiate export' });
  }
});

// GET /exports/:exportId/status - Check export status
router.get('/:exportId/status', (req, res) => {
  try {
    const { exportId } = req.params;
    const job = getExportStatus(exportId);

    if (!job) {
      return res.status(404).json({ error: 'Export not found' });
    }

    res.status(200).json({
      exportId: job.exportId,
      status: job.status,
      progress: {
        totalRows: job.progress.totalRows,
        processedRows: job.progress.processedRows,
        percentage: job.getPercentage(),
      },
      error: job.error,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    });
  } catch (err) {
    console.error('Error checking status:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// GET /exports/:exportId/download - Download export file
router.get('/:exportId/download', (req, res) => {
  try {
    const { exportId } = req.params;
    const job = getExportStatus(exportId);

    if (!job) {
      return res.status(404).json({ error: 'Export not found' });
    }

    if (job.status !== 'completed') {
      return res.status(425).json({ error: 'Export not yet completed' });
    }

    const filePath = getExportFilePath(exportId);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const range = req.headers.range;

    // Handle gzip compression
    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${exportId}.csv"`);
      res.setHeader('Transfer-Encoding', 'chunked');
      
      const gzip = zlib.createGzip();
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(gzip).pipe(res);
      return;
    }

    // Handle range requests (resumable downloads)
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', end - start + 1);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${exportId}.csv"`);

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      // Standard download
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${exportId}.csv"`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  } catch (err) {
    console.error('Error downloading export:', err);
    res.status(500).json({ error: 'Failed to download export' });
  }
});

// DELETE /exports/:exportId - Cancel export
router.delete('/:exportId', (req, res) => {
  try {
    const { exportId } = req.params;
    const job = getExportStatus(exportId);

    if (!job) {
      return res.status(404).json({ error: 'Export not found' });
    }

    cancelExport(exportId);
    res.status(204).send();
  } catch (err) {
    console.error('Error cancelling export:', err);
    res.status(500).json({ error: 'Failed to cancel export' });
  }
});

module.exports = router;
