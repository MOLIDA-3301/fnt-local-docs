$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$tauriRoot = Join-Path $appRoot "src-tauri"
$pythonScript = Join-Path $tauriRoot "scripts\images_to_pdf.py"
$buildRoot = Join-Path $tauriRoot "sidecar-build"
$binaryRoot = Join-Path $tauriRoot "binaries"
$targetTriple = (& rustc --print host-tuple).Trim()

New-Item -ItemType Directory -Path $binaryRoot -Force | Out-Null
python -m PyInstaller --noconfirm --clean --onefile --name fnt-converter --distpath (Join-Path $buildRoot "dist") --workpath (Join-Path $buildRoot "work") --specpath $buildRoot $pythonScript

$sourceBinary = Join-Path $buildRoot "dist\fnt-converter.exe"
$targetBinary = Join-Path $binaryRoot "fnt-converter-$targetTriple.exe"
Copy-Item -LiteralPath $sourceBinary -Destination $targetBinary -Force
Write-Output $targetBinary
