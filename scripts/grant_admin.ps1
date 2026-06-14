# Grant admin access to a user by email (e.g. after switching to a fresh database).
param(
    [Parameter(Mandatory = $true)]
    [string]$Email,
    [string]$DbHost = $env:DB_HOST,
    [string]$DbPort = $env:DB_PORT,
    [string]$DbName = $env:DB_NAME,
    [string]$DbUser = $env:DB_USER,
    [string]$DbPassword = $env:DB_PASSWORD,
    [string]$DockerContainer = $env:DB_DOCKER_CONTAINER
)

$ErrorActionPreference = "Stop"

if (-not $DbHost) { $DbHost = "localhost" }
if (-not $DbPort) { $DbPort = "5434" }
if (-not $DbName) { $DbName = "postgres" }
if (-not $DbUser) { $DbUser = "postgres" }
if (-not $DbPassword) { $DbPassword = "root" }
if (-not $DockerContainer) { $DockerContainer = "crypto-trade-db-1" }

$escapedEmail = $Email.Replace("'", "''")
$sql = "UPDATE users SET is_admin = true WHERE email = '$escapedEmail' RETURNING id, email, is_admin;"

if (Get-Command docker -ErrorAction SilentlyContinue) {
    $running = docker ps --format "{{.Names}}" 2>$null | Select-String -SimpleMatch $DockerContainer
    if ($running) {
        docker exec $DockerContainer psql -U $DbUser -d $DbName -c $sql
        if ($LASTEXITCODE -ne 0) { throw "grant_admin failed" }
        Write-Host "`nDone. Log out and back in so the JWT picks up admin access."
        exit 0
    }
}

$env:PGPASSWORD = $DbPassword
& psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c $sql
if ($LASTEXITCODE -ne 0) { throw "grant_admin failed" }
Write-Host "`nDone. Log out and back in so the JWT picks up admin access."
