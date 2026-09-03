export type ViewId = "home" | "convert" | "export" | "ocr" | "pdf" | "batch" | "history" | "settings" | "guide" | "about" | "workspace";

export type ToolId =
  | "mixed-pdf" | "batch-pdf" | "word-pdf" | "ppt-pdf" | "sheet-pdf" | "text-pdf" | "html-pdf" | "images-pdf" | "scan-pdf"
  | "pdf-word" | "pdf-excel" | "pdf-ppt" | "pdf-text" | "pdf-markdown" | "pdf-images"
  | "ocr-text" | "ocr-markdown" | "ocr-word" | "ocr-searchable"
  | "merge-pdf" | "split-pdf" | "organize-pdf" | "compress-pdf" | "stamp-pdf" | "encrypt-pdf" | "decrypt-pdf";

export type ToolDefinition = {
  id: ToolId;
  group: Exclude<ViewId, "home" | "batch" | "history" | "settings" | "guide" | "about" | "workspace">;
  icon: string;
  title: string;
  description: string;
  accepts: string;
  requirement: "any" | "image" | "pdf" | "ocr";
  multi?: boolean;
  badge?: string;
};

export const TOOLS: ToolDefinition[] = [
  { id: "mixed-pdf", group: "convert", icon: "PDF", title: "文件转 PDF", description: "Word、PPT、Excel、CSV、HTML、文本和图片统一转为 PDF。", accepts: "DOCX · PPTX · XLSX · CSV · HTML · TXT · MD · 图片", requirement: "any", multi: true, badge: "常用" },
  { id: "batch-pdf", group: "convert", icon: "批", title: "批量转 PDF", description: "逐文件转换，保留每项结果、进度和失败原因。", accepts: "文件或整个文件夹", requirement: "any", multi: true },
  { id: "word-pdf", group: "convert", icon: "W", title: "Word 转 PDF", description: "将 DOC、DOCX 文档转换为标准 PDF。", accepts: "DOC · DOCX", requirement: "any", multi: true },
  { id: "ppt-pdf", group: "convert", icon: "P", title: "PowerPoint 转 PDF", description: "将 PPT、PPTX 演示文稿转换为 PDF。", accepts: "PPT · PPTX", requirement: "any", multi: true },
  { id: "sheet-pdf", group: "convert", icon: "X", title: "Excel / CSV 转 PDF", description: "将表格文件转换为便于分享和打印的 PDF。", accepts: "XLS · XLSX · CSV", requirement: "any", multi: true },
  { id: "text-pdf", group: "convert", icon: "TXT", title: "文本 / Markdown 转 PDF", description: "内置引擎离线排版，支持中文、英文和自动分页。", accepts: "TXT · MD · Markdown", requirement: "any", multi: true },
  { id: "html-pdf", group: "convert", icon: "HTML", title: "HTML 转 PDF", description: "通过本机 LibreOffice 将 HTML 文件转换为 PDF。", accepts: "HTML · HTM", requirement: "any", multi: true },
  { id: "images-pdf", group: "convert", icon: "图", title: "图片合并 PDF", description: "上移、下移调整顺序，PDF 页序严格跟随队列。", accepts: "JPG · PNG · WebP · BMP · TIFF", requirement: "image", multi: true },
  { id: "scan-pdf", group: "convert", icon: "扫", title: "扫描件风格 PDF", description: "灰度、对比度增强后生成适合归档的扫描风格 PDF。", accepts: "JPG · PNG · WebP · BMP · TIFF", requirement: "image", multi: true },

  { id: "pdf-word", group: "export", icon: "W", title: "PDF 转 Word", description: "电子 PDF 优先还原版式，扫描 PDF 自动使用 OCR。", accepts: "PDF", requirement: "pdf", badge: "版式还原" },
  { id: "pdf-excel", group: "export", icon: "X", title: "PDF 转 Excel", description: "识别有框/无框表格、多表格，并附带 Raw 坐标数据。", accepts: "PDF", requirement: "pdf", badge: "智能表格" },
  { id: "pdf-ppt", group: "export", icon: "P", title: "PDF 转 PPT", description: "每页生成一张视觉一致的幻灯片，适合演示与归档。", accepts: "PDF", requirement: "pdf" },
  { id: "pdf-text", group: "export", icon: "TXT", title: "PDF 转 TXT", description: "提取电子 PDF 文字，扫描文件可切换 OCR。", accepts: "PDF", requirement: "pdf" },
  { id: "pdf-markdown", group: "export", icon: "MD", title: "PDF 转 Markdown", description: "导出便于整理、检索和再次编辑的 Markdown 文本。", accepts: "PDF", requirement: "pdf" },
  { id: "pdf-images", group: "export", icon: "IMG", title: "PDF 转图片", description: "逐页渲染 PNG 并自动打包 ZIP，可调整清晰度。", accepts: "PDF", requirement: "pdf" },

  { id: "ocr-text", group: "ocr", icon: "字", title: "OCR 转 TXT", description: "离线识别中文和英文，低置信度内容会被标记。", accepts: "图片 · 扫描 PDF", requirement: "ocr" },
  { id: "ocr-markdown", group: "ocr", icon: "MD", title: "OCR 转 Markdown", description: "识别为带简单排版标记的纯文本；用 # 表示标题、- 表示列表，记事本也能打开。", accepts: "图片 · 扫描 PDF", requirement: "ocr" },
  { id: "ocr-word", group: "ocr", icon: "W", title: "OCR 转 Word", description: "将图片或扫描 PDF 转成可编辑 Word 文档。", accepts: "图片 · 扫描 PDF", requirement: "ocr" },
  { id: "ocr-searchable", group: "ocr", icon: "搜", title: "生成可搜索 PDF", description: "保留原页面并加入隐藏文字层，支持复制与搜索。", accepts: "图片 · 扫描 PDF", requirement: "ocr", badge: "离线 OCR" },

  { id: "merge-pdf", group: "pdf", icon: "合", title: "合并 PDF", description: "按队列顺序将多个 PDF 合并成一个文件。", accepts: "多个 PDF", requirement: "pdf", multi: true },
  { id: "split-pdf", group: "pdf", icon: "拆", title: "拆分 PDF", description: "按单页或每 N 页拆分，结果自动打包 ZIP。", accepts: "PDF", requirement: "pdf" },
  { id: "organize-pdf", group: "pdf", icon: "页", title: "整理 PDF 页面", description: "提取、删除、重排和旋转页面，一次完成。", accepts: "PDF", requirement: "pdf" },
  { id: "compress-pdf", group: "pdf", icon: "压", title: "压缩 PDF", description: "进行无损结构优化，减少可清理的冗余数据。", accepts: "PDF", requirement: "pdf" },
  { id: "stamp-pdf", group: "pdf", icon: "印", title: "水印与页码", description: "添加文字、图片或图案水印，也可加入连续页码。", accepts: "PDF · PNG/JPG/WebP 水印", requirement: "pdf" },
  { id: "encrypt-pdf", group: "pdf", icon: "锁", title: "加密 PDF", description: "使用 AES-256 密码加密保护文档。", accepts: "PDF", requirement: "pdf" },
  { id: "decrypt-pdf", group: "pdf", icon: "解", title: "解密 PDF", description: "输入原密码，导出不再加密的 PDF。", accepts: "加密 PDF", requirement: "pdf" },
];

export const GROUP_COPY = {
  convert: { title: "转成 PDF", subtitle: "将常见办公文档、文本和图片转换为标准 PDF" },
  export: { title: "从 PDF 导出", subtitle: "导出 Word、Excel、PPT、图片和文本" },
  ocr: { title: "OCR 文字识别", subtitle: "图片与扫描文档离线转为可编辑内容" },
  pdf: { title: "PDF 工具", subtitle: "合并、拆分、整理、压缩、水印和安全保护" },
} as const;
