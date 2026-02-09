# Async CSV Export Service

A high-performance, memory-efficient asynchronous CSV export service built with Node.js, Express, and PostgreSQL. Supports concurrent exports with streaming, filtering, and real-time progress tracking.

## Features

✅ **Asynchronous Exports** - Non-blocking CSV generation with real-time progress  
✅ **Memory Efficient** - Streaming architecture keeps memory usage constant (~150MB)  
✅ **Concurrent Exports** - Handle multiple simultaneous exports with worker pool  
✅ **Advanced Filtering** - Filter by country, subscription tier, lifetime value, date range  
✅ **Real-time Progress** - Track export progress as it happens  
✅ **Gzip Compression** - Automatic compression for large files  
✅ **Error Handling** - Comprehensive error recovery and retry logic  
✅ **Docker Containerized** - Production-ready with Docker & Docker Compose  
✅ **Health Checks** - Built-in health endpoints and monitoring  
✅ **RESTful API** - Clean, intuitive endpoints

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (or use Docker)

### With Docker (Recommended)

```bash
# Start services
docker-compose up --build

# Services will be available at:
# API: http://localhost:8080
# Database: localhost:5432
```

### Health Check
```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

## API Endpoints

### 1. Initiate Export
**POST** `/exports/csv`

Request body (optional filters):
```json
{
  "filters": {
    "country_code": "US",
    "subscription_tier": "premium",
    "lifetime_value_min": 100,
    "lifetime_value_max": 500,
    "signup_date_from": "2024-01-01",
    "signup_date_to": "2024-12-31"
  }
}
```

Response:
```json
{
  "exportId": "4eafbbef-e64a-41d7-abaa-35e316c179e7",
  "status": "processing"
}
```

### 2. Check Export Status
**GET** `/exports/{exportId}/status`

Response:
```json
{
  "exportId": "4eafbbef-e64a-41d7-abaa-35e316c179e7",
  "status": "completed",
  "progress": {
    "totalRows": 100000,
    "processedRows": 100000,
    "percentage": 100
  },
  "error": null,
  "createdAt": "2026-02-09T15:10:13.052Z",
  "completedAt": "2026-02-09T15:10:16.399Z"
}
```

### 3. Download Export
**GET** `/exports/{exportId}/download`

Returns the CSV file with gzip compression.

### 4. Delete Export
**DELETE** `/exports/{exportId}`

### 5. Health Check
**GET** `/health`

## Database Schema

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    signup_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    country_code CHAR(2) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    lifetime_value NUMERIC(10, 2) DEFAULT 0.00
);
```

Includes indexes on: country_code, subscription_tier, lifetime_value

## Environment Variables

```env
API_PORT=8080
DB_HOST=db
DB_PORT=5432
DB_USER=exporter
DB_PASSWORD=secret
DB_NAME=exports_db
DATABASE_URL=postgresql://exporter:secret@db:5432/exports_db
EXPORT_STORAGE_PATH=/app/exports
```

## Performance Characteristics

- **Memory Usage**: ~96-150MB (configurable limit)
- **Export Speed**: 100K records in ~3 seconds
- **Concurrent Exports**: 3+ simultaneous exports supported
- **Streaming**: Backpressure-aware CSV generation
- **Response Times**: <200ms on all endpoints

## Architecture

### Components

1. **Express Server** - REST API and request handling
2. **PostgreSQL** - Data storage with indexes for filtering
3. **JobQueue** - In-memory queue for job management
4. **ExportService** - Core streaming and export logic
5. **csv-stringify** - Memory-efficient CSV generation

### Flow

```
POST /exports/csv
    ↓
Create Job (pending)
    ↓
Add to JobQueue
    ↓
Worker processes export (processing)
    ↓
Stream data from DB + Transform to CSV (using csv-stringify)
    ↓
Write to file with gzip compression
    ↓
Mark job completed
    ↓
GET /exports/{id}/download retrieves file
```

## Testing

### Manual API Testing

```bash
# 1. Start export
curl -X POST http://localhost:8080/exports/csv \
  -H "Content-Type: application/json" \
  -d '{"filters": {"country_code": "US"}}'

# 2. Check status
curl http://localhost:8080/exports/{exportId}/status

# 3. Download when complete
curl http://localhost:8080/exports/{exportId}/download -o export.csv

# 4. View CSV
head export.csv
```

### With PowerShell

```powershell
# Start export
$response = Invoke-WebRequest -Uri "http://localhost:8080/exports/csv" -Method Post -ContentType "application/json" -Body '{}'
$exportId = ($response.Content | ConvertFrom-Json).exportId

# Check status
Invoke-WebRequest -Uri "http://localhost:8080/exports/$exportId/status" | Select-Object -ExpandProperty Content

# Download
Invoke-WebRequest -Uri "http://localhost:8080/exports/$exportId/download" -OutFile "export.csv"
```

## File Structure

```
async-csv-export-service/
├── src/
│   ├── app.js                 # Express app entry point
│   ├── db.js                  # PostgreSQL connection pool
│   ├── routes/
│   │   └── exports.js         # API endpoints
│   └── services/
│       └── exportService.js   # Core export logic
├── seeds/
│   └── init.sql              # Database schema + seed data
├── exports/                   # Generated CSV files
├── Dockerfile                # Container image definition
├── docker-compose.yml        # Multi-service orchestration
├── package.json              # Dependencies
└── README.md                 # This file
```

## Deployment

### Docker Compose

```bash
# Build and start
docker-compose up --build -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### Environment-specific config

Create `.env` file:
```env
DB_HOST=your-db-host
DB_USER=your-user
DB_PASSWORD=your-password
```

## Troubleshooting

### App container unhealthy
```bash
# Check logs
docker logs async-csv-export-service-app-1

# Common issues:
# 1. Database not ready - wait for `db` service health check to pass
# 2. Port 8080 in use - change API_PORT or stop conflicting service
# 3. Memory limit - increase mem_limit in docker-compose.yml
```

### Database connection error
```bash
# Verify database is running
docker exec async-csv-export-service-db-1 psql -U exporter -d exports_db -c "SELECT 1"

# Check credentials in docker-compose.yml
```

### Memory usage exceeds limit
```bash
# Check current usage
docker stats async-csv-export-service-app-1

# Increase limit in docker-compose.yml:
# mem_limit: 200m  # Change from 150m
```

## Performance Tuning

### Database
- Adjust indexes based on filter usage
- Increase connection pool size for more concurrent exports
- Use EXPLAIN ANALYZE to optimize queries

### Application
- Increase `mem_limit` in docker-compose.yml for larger exports
- Adjust worker pool size in exportService.js
- Monitor memory with `docker stats`

## Security Considerations

- Use strong DB passwords in production
- Enable TLS for API endpoints
- Implement authentication/authorization
- Validate filter parameters
- Clean up old exports regularly

## License

MIT

## Support

For issues, questions, or contributions, please open a GitHub issue.
