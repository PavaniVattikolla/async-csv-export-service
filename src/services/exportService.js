const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const { stringify } = require('csv-stringify');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

class ExportJob {
  constructor(exportId, filters = {}, columns = null, csvOptions = {}) {
    this.exportId = exportId;
    this.filters = filters;
    this.columns = columns;
    this.csvOptions = csvOptions;
    this.status = 'pending';
    this.progress = { totalRows: 0, processedRows: 0 };
    this.error = null;
    this.createdAt = new Date();
    this.completedAt = null;
    this.cancelled = false;
  }

  getPercentage() {
    if (this.progress.totalRows === 0) return 0;
    return Math.min(100, Math.round((this.progress.processedRows / this.progress.totalRows) * 100));
  }
}

class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.workers = new Map();
    this.maxConcurrentWorkers = 10;
    this.activeWorkers = 0;
  }

  createJob(filters = {}, columns = null, csvOptions = {}) {
    const exportId = uuidv4();
    const job = new ExportJob(exportId, filters, columns, csvOptions);
    this.jobs.set(exportId, job);
    return job;
  }

  getJob(exportId) {
    return this.jobs.get(exportId);
  }

  removeJob(exportId) {
    this.jobs.delete(exportId);
    this.workers.delete(exportId);
  }

  setJobStatus(exportId, status) {
    const job = this.jobs.get(exportId);
    if (job) {
      job.status = status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        job.completedAt = new Date();
      }
    }
  }

  setJobProgress(exportId, processedRows, totalRows) {
    const job = this.jobs.get(exportId);
    if (job) {
      job.progress.processedRows = processedRows;
      job.progress.totalRows = totalRows;
    }
  }

  setJobError(exportId, error) {
    const job = this.jobs.get(exportId);
    if (job) {
      job.error = error;
      job.status = 'failed';
      job.completedAt = new Date();
    }
  }

  cancelJob(exportId) {
    const job = this.jobs.get(exportId);
    if (job) {
      job.cancelled = true;
    }
  }

  async enqueueJob(exportId) {
    while (this.activeWorkers >= this.maxConcurrentWorkers) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeWorkers++;
  }

  dequeueJob() {
    this.activeWorkers = Math.max(0, this.activeWorkers - 1);
  }
}

const jobQueue = new JobQueue();

async function buildWhereClause(filters) {
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (filters.country_code) {
    conditions.push(`country_code = $${paramIndex++}`);
    values.push(filters.country_code);
  }

  if (filters.subscription_tier) {
    conditions.push(`subscription_tier = $${paramIndex++}`);
    values.push(filters.subscription_tier);
  }

  if (filters.min_ltv !== undefined) {
    conditions.push(`lifetime_value >= $${paramIndex++}`);
    values.push(parseFloat(filters.min_ltv));
  }

  return {
    clause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
    values,
  };
}

async function getRowCount(filters) {
  const { clause, values } = await buildWhereClause(filters);
  const query = `SELECT COUNT(*) as count FROM users ${clause}`;
  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count);
}

async function exportToCsv(exportId) {
  const job = jobQueue.getJob(exportId);
  if (!job) return;

  const exportPath = path.join(process.env.EXPORT_STORAGE_PATH || './exports', `${exportId}.csv`);
  const writeStream = fs.createWriteStream(exportPath);

  try {
    jobQueue.setJobStatus(exportId, 'processing');

    const { clause, values } = await buildWhereClause(job.filters);
    
    // Get total row count
    const totalRows = await getRowCount(job.filters);
    jobQueue.setJobProgress(exportId, 0, totalRows);

    // Define columns to export
    const allColumns = ['id', 'name', 'email', 'signup_date', 'country_code', 'subscription_tier', 'lifetime_value'];
    const columnsToExport = job.columns ? job.columns.split(',').map(c => c.trim()) : allColumns;

    // CSV stringify options
    const csvOptions = {
      header: true,
      columns: columnsToExport,
      delimiter: job.csvOptions.delimiter || ',',
      quote: job.csvOptions.quoteChar || '"',
    };

    const stringifier = stringify(csvOptions);
    stringifier.pipe(writeStream);

    // Fetch data in chunks using cursor
    const chunkSize = 1000;
    let offset = 0;
    let processedRows = 0;

    while (processedRows < totalRows) {
      if (job.cancelled) {
        stringifier.destroy();
        writeStream.destroy();
        fs.unlink(exportPath, () => {});
        jobQueue.setJobStatus(exportId, 'cancelled');
        return;
      }

      const query = `
        SELECT ${columnsToExport.join(', ')}
        FROM users
        ${clause}
        ORDER BY id
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}
      `;

      const result = await pool.query(query, [...values, chunkSize, offset]);
      const rows = result.rows;

      if (rows.length === 0) break;

      for (const row of rows) {
        stringifier.write(row);
      }

      processedRows += rows.length;
      offset += chunkSize;
      jobQueue.setJobProgress(exportId, processedRows, totalRows);
    }

    stringifier.end();

    writeStream.on('finish', () => {
      jobQueue.setJobStatus(exportId, 'completed');
    });

    writeStream.on('error', (err) => {
      jobQueue.setJobError(exportId, err.message);
      fs.unlink(exportPath, () => {});
    });
  } catch (err) {
    jobQueue.setJobError(exportId, err.message);
    writeStream.destroy();
    fs.unlink(exportPath, () => {});
  } finally {
    jobQueue.dequeueJob();
  }
}

async function startExport(filters, columns, csvOptions) {
  const job = jobQueue.createJob(filters, columns, csvOptions);
  
  jobQueue.enqueueJob(job.exportId).then(() => {
    exportToCsv(job.exportId);
  });

  return job;
}

function cancelExport(exportId) {
  const job = jobQueue.getJob(exportId);
  if (job && ['pending', 'processing'].includes(job.status)) {
    jobQueue.cancelJob(exportId);
    const exportPath = path.join(process.env.EXPORT_STORAGE_PATH || './exports', `${exportId}.csv`);
    fs.unlink(exportPath, () => {});
  }
}

function getExportStatus(exportId) {
  return jobQueue.getJob(exportId);
}

function getExportFilePath(exportId) {
  return path.join(process.env.EXPORT_STORAGE_PATH || './exports', `${exportId}.csv`);
}

module.exports = {
  startExport,
  cancelExport,
  getExportStatus,
  getExportFilePath,
  jobQueue,
};
