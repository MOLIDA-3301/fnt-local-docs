# FNT Local Docs Desktop

Windows-first, local-first document conversion and OCR desktop app.

## Development

Requirements: Node.js, Rust with the MSVC toolchain, and Python 3.13. The
packaged conversion sidecar contains the PDF, spreadsheet, presentation, image,
and offline Chinese/English OCR libraries. LibreOffice is optional and is
discovered at runtime for Office/CSV/HTML to PDF conversion.

```powershell
npm install
npm run tauri dev
```

Create Windows installers with `npm run tauri build`. Generated MSI and NSIS installers are written under `src-tauri/target/release/bundle/`.

## Product scope

The complete acceptance matrix, including the honest implementation status of
each feature, is maintained in [docs/feature-matrix.md](docs/feature-matrix.md).

## Implemented desktop flow

- Add individual files, multiple files, or folders by picker or drag-and-drop.
- Convert images, text, Markdown, Office files, CSV, and HTML to PDF; combine
  mixed inputs in queue order.
- Export PDF to text, Markdown, images, Word, Excel, or visual-fidelity PPT.
- Run offline Chinese/English OCR and create editable or searchable outputs.
- Merge, split, organize, compress, watermark, number, encrypt, and decrypt PDFs.
- Pause, resume, cancel, and retry batch work; retain local history and preview
  supported results in a responsive side/bottom panel.
- Enforce image and batch resource limits while isolating per-file failures.

Core processing remains offline. Release installers bundle the Python conversion
sidecar, so end users do not need Python. Advanced Office conversion uses the
user-installed LibreOffice executable when available.
