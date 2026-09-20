# Builds backend/dist/innledger-server.exe (FastAPI + the built React app in one file).
# Run `npm run build` in ../frontend first.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ..\frontend\dist\index.html)) { throw "Build the frontend first (cd frontend; npm run build)" }

$py = if (Test-Path .\.venv\Scripts\python.exe) { ".\.venv\Scripts\python.exe" } else { "python" }

& $py -m PyInstaller --noconfirm --clean --onefile --name innledger-server `
    --add-data "..\frontend\dist;static" `
    --collect-submodules uvicorn `
    --collect-submodules app `
    --collect-submodules sqlalchemy.dialects.sqlite `
    --collect-submodules passlib `
    --hidden-import email_validator `
    --hidden-import multipart `
    run_desktop.py
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
