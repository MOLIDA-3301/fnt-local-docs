# Product Scope

## Platform

- Windows 10 and Windows 11 first.
- Local, offline-first processing; no account or server is required for core features.

## Conversion

- Office, text, HTML, and images to PDF.
- PDF to text, Markdown, images, Word, Excel, and presentation output.
- Batch queue with progress, errors, individual save, and save-all.

## PDF and OCR

- OCR for images and scanned PDFs, with searchable-PDF output.
- PDF merge, page split, page extraction, rotation, compression, watermark, and AES-256 password protection.
- Image-to-PDF ordering follows the user-controlled queue order.

## Preview

- Preview images, PDFs, text, audio, and video after conversion.
- Use a side drawer in wide windows and a bottom panel in narrow windows.

## Resource limits

- One image: at most 50 MP or 16,384 px on either edge.
- Image-to-PDF job: at most 100 MP in total.
- Batch input: at most 2 GB.
- PDF and OCR jobs have no page-count cap, but process page-by-page and surface slow-job guidance.

## Quality expectations

- PDF-to-Word and PDF-to-Excel are best-effort conversions.
- Excel extraction supports text-coordinate parsing, OCR fallback, bordered/borderless tables, multiple tables, cross-page continuation, merged cells, low-confidence annotations, and Raw fallback output.
