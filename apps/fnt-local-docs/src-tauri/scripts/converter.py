import argparse
import json
import sys
import tempfile
import zipfile
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter


def images_to_pdf(sources: list[Path], destination: Path) -> None:
    if not sources:
        raise ValueError("至少需要一张图片")
    images: list[Image.Image] = []
    total_pixels = 0
    try:
        for source in sources:
            with Image.open(source) as opened:
                width, height = opened.size
                pixels = width * height
                if pixels > 50_000_000 or width > 16384 or height > 16384:
                    raise ValueError(f"图片超出限制：{source.name}（最大 50MP / 16384px）")
                total_pixels += pixels
                if total_pixels > 100_000_000:
                    raise ValueError("图片合并任务总计超过 100MP")
                images.append(opened.convert("RGB").copy())
        destination.parent.mkdir(parents=True, exist_ok=True)
        images[0].save(destination, "PDF", save_all=True, append_images=images[1:], resolution=150)
    finally:
        for image in images:
            image.close()


def merge_pdfs(sources: list[Path], destination: Path) -> None:
    if not sources:
        raise ValueError("至少需要一个 PDF")
    writer = PdfWriter()
    for source in sources:
        writer.append(str(source))
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        writer.write(stream)


def split_pdf(source: Path, destination: Path, every: int, password: str | None) -> None:
    if every < 1:
        raise ValueError("每组页数必须大于 0")
    reader = PdfReader(source)
    if reader.is_encrypted and not reader.decrypt(password or ""):
        raise ValueError("PDF 密码不正确")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temp:
        temp_dir = Path(temp)
        parts: list[Path] = []
        for start in range(0, len(reader.pages), every):
            writer = PdfWriter()
            for page in reader.pages[start : start + every]:
                writer.add_page(page)
            part = temp_dir / f"{source.stem}_{start + 1:04d}-{min(start + every, len(reader.pages)):04d}.pdf"
            with part.open("wb") as stream:
                writer.write(stream)
            parts.append(part)
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for part in parts:
                archive.write(part, part.name)


def encrypt_pdf(source: Path, destination: Path, password: str) -> None:
    if not password:
        raise ValueError("密码不能为空")
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.encrypt(user_password=password, algorithm="AES-256")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        writer.write(stream)


def decrypt_pdf(source: Path, destination: Path, password: str) -> None:
    reader = PdfReader(source)
    if not reader.is_encrypted:
        raise ValueError("该 PDF 未加密")
    if not reader.decrypt(password):
        raise ValueError("PDF 密码不正确")
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as stream:
        writer.write(stream)


def pdf_to_text(source: Path, destination: Path, output_format: str, password: str | None) -> None:
    reader = PdfReader(source)
    if reader.is_encrypted and not reader.decrypt(password or ""):
        raise ValueError("PDF 密码不正确")
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    if not any(pages):
        raise ValueError("未提取到电子文字：该文档可能是扫描件，请使用 OCR")
    if output_format == "markdown":
        content = "\n\n".join(f"## 第 {index} 页\n\n{text}" for index, text in enumerate(pages, 1) if text)
    else:
        content = "\n\n".join(f"===== 第 {index} 页 =====\n{text}" for index, text in enumerate(pages, 1) if text)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    images = subparsers.add_parser("images-to-pdf")
    images.add_argument("--destination", required=True)
    images.add_argument("--source", action="append", required=True)
    merge = subparsers.add_parser("merge-pdf")
    merge.add_argument("--destination", required=True)
    merge.add_argument("--source", action="append", required=True)
    split = subparsers.add_parser("split-pdf")
    split.add_argument("--source", required=True)
    split.add_argument("--destination", required=True)
    split.add_argument("--every", type=int, default=1)
    split.add_argument("--password")
    encrypt = subparsers.add_parser("encrypt-pdf")
    encrypt.add_argument("--source", required=True)
    encrypt.add_argument("--destination", required=True)
    encrypt.add_argument("--password", required=True)
    decrypt = subparsers.add_parser("decrypt-pdf")
    decrypt.add_argument("--source", required=True)
    decrypt.add_argument("--destination", required=True)
    decrypt.add_argument("--password", required=True)
    text = subparsers.add_parser("pdf-to-text")
    text.add_argument("--source", required=True)
    text.add_argument("--destination", required=True)
    text.add_argument("--format", choices=["text", "markdown"], default="text")
    text.add_argument("--password")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    if args.command == "images-to-pdf":
        images_to_pdf([Path(value) for value in args.source], Path(args.destination))
    elif args.command == "merge-pdf":
        merge_pdfs([Path(value) for value in args.source], Path(args.destination))
    elif args.command == "split-pdf":
        split_pdf(Path(args.source), Path(args.destination), args.every, args.password)
    elif args.command == "encrypt-pdf":
        encrypt_pdf(Path(args.source), Path(args.destination), args.password)
    elif args.command == "decrypt-pdf":
        decrypt_pdf(Path(args.source), Path(args.destination), args.password)
    elif args.command == "pdf-to-text":
        pdf_to_text(Path(args.source), Path(args.destination), args.format, args.password)
    print(json.dumps({"ok": True}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
