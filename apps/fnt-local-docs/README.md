# DocBox · 纸间文档盒

DocBox（纸间文档盒）是 FNT 原创的免费 Windows 文档转换、OCR 与 PDF 工具。官方网站：[www.fornowtoday.com](https://www.fornowtoday.com)，联系邮箱：[ouo@fornowtoday.com](mailto:ouo@fornowtoday.com)。软件面向学习、交流及个人非商业使用；详细授权、反套皮与再发布限制见 [LICENSE](LICENSE)，版权说明见 [NOTICE.md](NOTICE.md)。

## 运行要求

| 能力 | 是否需要额外安装 |
| --- | --- |
| OCR、PDF 导出、图片/文本转 PDF、PDF 整理与安全工具 | 不需要，相关引擎和中英文模型已内置 |
| DOC/DOCX、PPT/PPTX、XLS/XLSX/CSV、HTML 转 PDF | 需要免费的 LibreOffice |
| 软件界面 | 使用 Microsoft WebView2；Windows 10/11 通常自带，缺失时安装器会补装 |

不需要另装 Python、Tesseract、FFmpeg 或 AVS3。处理文件不会因为安装 WebView2 或 LibreOffice 而自动上传。

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
- Save default output, naming, conflict, OCR/DPI, LibreOffice, and temporary
  resource-path preferences in the local settings center.
- Enforce image and batch resource limits while isolating per-file failures.

Core processing remains offline. Release installers bundle the Python conversion
sidecar, so end users do not need Python. Advanced Office conversion uses the
user-installed LibreOffice executable when available.
