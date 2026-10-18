# SmartAlloc Setup Script for Windows PowerShell
# Run from the smartalloc/ directory: .\setup.ps1

Write-Host "SmartAlloc Setup" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan

# Check Node
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Download from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Install deps
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Yellow
npm install
npm install --workspace=server
npm install --workspace=client

# Check .env
if (-not (Test-Path "server\.env")) {
    Copy-Item ".env.example" "server\.env"
    Write-Host "⚠️  Created server\.env from template. Edit DB_PASSWORD before continuing." -ForegroundColor Yellow
    notepad "server\.env"
    Read-Host "Press Enter after saving your .env file"
}

# Migrate
Write-Host "`n🗄️  Running database migrations..." -ForegroundColor Yellow
npm run db:migrate

# Seed
Write-Host "`n🌱 Seeding demo data..." -ForegroundColor Yellow
npm run db:seed

Write-Host "`n✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the app, open TWO PowerShell windows:" -ForegroundColor Cyan
Write-Host "  Window 1: npm run dev:server" -ForegroundColor White
Write-Host "  Window 2: npm run dev:client" -ForegroundColor White
Write-Host ""
Write-Host "Then open: http://localhost:5173" -ForegroundColor Cyan
