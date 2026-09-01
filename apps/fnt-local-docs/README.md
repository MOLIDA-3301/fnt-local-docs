# FNT Local Docs Desktop

Windows-first, local-first document conversion and OCR desktop app.

## Development

Requirements: Node.js, Rust with the MSVC toolchain, Python 3.13, and Pillow.

```powershell
npm install
npm run tauri dev
```

Create Windows installers with `npm run tauri build`. Generated MSI and NSIS installers are written under `src-tauri/target/release/bundle/`.

## Implemented alpha flow

- Select local images with the Windows file picker.
- Reorder or remove queued files.
- Merge images into a PDF in queue order.
- Enforce 50MP/16,384px per-image and 100MP per-job limits.
- Persist queue state and conversion results locally.

Core processing remains offline. The current alpha expects Python and Pillow on the machine; bundling the conversion runtime is the next packaging milestone.
