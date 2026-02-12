# PowerShell script to run the 10M seed inside the DB container
param()
try {
    $container = docker ps --filter "name=async-csv-export-service-db-1" --format '{{.Names}}'
    if (-not $container) { Write-Error 'Database container not running. Start docker compose first.'; exit 1 }
    Write-Host 'Copying seed_10m.sql into container...'
    docker cp .\seeds\seed_10m.sql $container:/seed_10m.sql
    Write-Host 'Executing seed (this may take a long time)...'
    docker exec -it $container psql -U exporter -d exports_db -v ON_ERROR_STOP=1 -f /seed_10m.sql
    Write-Host 'Seeding completed.'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
