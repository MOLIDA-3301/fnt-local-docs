$ErrorActionPreference = "Stop"

$appRoot = Split-Path -Parent $PSScriptRoot
$tauriRoot = Join-Path $appRoot "src-tauri"
$pythonScript = Join-Path $tauriRoot "scripts\converter.py"
$buildRoot = Join-Path $tauriRoot "sidecar-build"
$binaryRoot = Join-Path $tauriRoot "binaries"
$rustc = (Get-Command rustc -ErrorAction SilentlyContinue).Source
if (-not $rustc) {
    $rustc = "C:\Users\Ou\.cargo\bin\rustc.exe"
}
if (-not (Test-Path -LiteralPath $rustc)) {
    throw "未找到 Rust 编译器。请先安装 Rust MSVC 工具链。"
}
$targetTriple = (& $rustc --print host-tuple).Trim()
$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) {
    $python = "C:\Users\Ou\AppData\Local\Programs\Python\Python313\python.exe"
}
if (-not (Test-Path -LiteralPath $python)) {
    throw "未找到 Python 3。请先安装 Python，或把 python.exe 加入 PATH。"
}

New-Item -ItemType Directory -Path $binaryRoot -Force | Out-Null
$excludedModules = @(
    "IPython",
    "matplotlib",
    "pandas",
    "pytest",
    "setuptools",
    "tkinter",
    "torch",
    "tensorflow",
    "paddle",
    "paddleocr"
)
$excludeArgs = $excludedModules | ForEach-Object { "--exclude-module=$_" }

& $python -m PyInstaller --noconfirm --clean --onefile --optimize 2 --name fnt-converter --collect-data rapidocr $excludeArgs --distpath (Join-Path $buildRoot "dist") --workpath (Join-Path $buildRoot "work") --specpath $buildRoot $pythonScript

$sourceBinary = Join-Path $buildRoot "dist\fnt-converter.exe"
$targetBinary = Join-Path $binaryRoot "fnt-converter-$targetTriple.exe"
Copy-Item -LiteralPath $sourceBinary -Destination $targetBinary -Force
Write-Output $targetBinary
