import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import "./App.css";
import "./engine.css";

type JobStatus = "waiting" | "running" | "paused" | "completed" | "failed" | "cancelled";
type Job = {
  id: number;
  name: string;
  path: string;
  kind: string;
  status: JobStatus;
  progress: number;
  detail: string;
  output?: string;
};
type HistoryEntry = { id: number; source: string; time: string; output?: string; error?: string };
type LocalFile = { path: string; size: number };

const STORAGE_KEY = "fnt.queue.v2";
const HISTORY_KEY = "fnt.history.v1";
const IS_TAURI = "__TAURI_INTERNALS__" in window;
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);
const OFFICE_EXTENSIONS = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "html", "htm"]);
const TO_PDF_EXTENSIONS = new Set(["pdf", "txt", "md", "markdown", ...IMAGE_EXTENSIONS, ...OFFICE_EXTENSIONS]);
const STATUS_LABEL: Record<JobStatus, string> = {
  waiting: "等待中",
  running: "处理中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

function loadJobs(): Job[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Job[]) : [];
  } catch {
    return [];
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? (JSON.parse(saved) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function fileName(path: string) {
  return path.split(/[\\/]/).pop() ?? path;
}

function isImage(path: string) {
  return IMAGE_EXTENSIONS.has(path.split(".").pop()?.toLowerCase() ?? "");
}

function isPdf(path: string) {
  return path.toLowerCase().endsWith(".pdf");
}

function extension(path: string) {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

function jobKind(path: string) {
  if (isImage(path)) return "图片 → PDF";
  if (isPdf(path)) return "PDF 工具 / 合并";
  if (TO_PDF_EXTENSIONS.has(extension(path))) return `${extension(path).toUpperCase()} → PDF`;
  return "暂不支持的格式";
}

const INITIAL_JOBS = loadJobs();
const INITIAL_HISTORY = loadHistory();

function FilePreview({ path }: { path?: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const suffix = path ? extension(path) : "";
  const textType = ["txt", "md", "markdown", "csv", "html", "htm", "json", "log"].includes(suffix);

  useEffect(() => {
    setContent("");
    setError("");
    if (!path || !textType) return;
    if (!IS_TAURI) {
      setError("浏览器演示环境不读取本机文件；桌面版可正常预览。");
      return;
    }
    invoke<string>("read_preview_text", { path }).then(setContent).catch((reason) => setError(String(reason)));
  }, [path, textType]);

  if (!path) return <div className="file-preview placeholder">转换结果将在这里预览。</div>;
  if (!IS_TAURI) return <div className="file-preview placeholder">浏览器演示环境不读取本机文件；桌面版可正常预览。</div>;
  const source = convertFileSrc(path);
  if (IMAGE_EXTENSIONS.has(suffix)) return <div className="file-preview"><img src={source} alt={fileName(path)} /></div>;
  if (suffix === "pdf") return <div className="file-preview pdf"><iframe src={source} title={`PDF 预览：${fileName(path)}`} /></div>;
  if (textType) return <div className="file-preview text"><pre>{error || content || "正在读取文本…"}</pre></div>;
  if (["mp3", "wav", "m4a", "ogg"].includes(suffix)) return <div className="file-preview media"><audio controls src={source}>当前系统无法预览此音频格式。</audio></div>;
  if (["mp4", "webm", "mov", "mkv"].includes(suffix)) return <div className="file-preview media"><video controls src={source}>当前系统无法预览此视频格式。</video></div>;
  return <div className="file-preview placeholder">该结果格式暂不提供内嵌预览，可使用“打开结果”。</div>;
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [history, setHistory] = useState<HistoryEntry[]>(INITIAL_HISTORY);
  const [selectedId, setSelectedId] = useState<number | null>(INITIAL_JOBS[0]?.id ?? null);
  const [pagesPerFile, setPagesPerFile] = useState(1);
  const [imageDpi, setImageDpi] = useState(150);
  const [ocrConfidence, setOcrConfidence] = useState(80);
  const [pageSpec, setPageSpec] = useState("");
  const [rotation, setRotation] = useState(0);
  const [watermark, setWatermark] = useState("");
  const [pageNumbers, setPageNumbers] = useState(false);
  const [outputFolder, setOutputFolder] = useState("");
  const [namingRule, setNamingRule] = useState("{name}");
  const [conflictPolicy, setConflictPolicy] = useState<"rename" | "overwrite" | "skip">("rename");
  const [batchStatus, setBatchStatus] = useState<"idle" | "running" | "paused" | "cancelled">("idle");
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const jobsRef = useRef(jobs);
  const terminalSignaturesRef = useRef(new Map(
    INITIAL_JOBS
      .filter((job) => job.status === "completed" || job.status === "failed")
      .map((job) => [job.id, `${job.status}|${job.output ?? ""}|${job.detail}`]),
  ));
  const [password, setPassword] = useState("");
  const [libreOfficePath, setLibreOfficePath] = useState<string | null | undefined>(undefined);
  const selectedJob = jobs.find((job) => job.id === selectedId);
  const imageJobs = useMemo(() => jobs.filter((job) => isImage(job.path)), [jobs]);
  const pdfJobs = useMemo(() => jobs.filter((job) => isPdf(job.path)), [jobs]);
  const completedCount = useMemo(() => jobs.filter((job) => job.status === "completed").length, [jobs]);
  const toPdfJobs = useMemo(() => jobs.filter((job) => TO_PDF_EXTENSIONS.has(extension(job.path))), [jobs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500)));
  }, [history]);

  useEffect(() => {
    const additions: HistoryEntry[] = [];
    for (const job of jobs) {
      if (job.status !== "completed" && job.status !== "failed") continue;
      const signature = `${job.status}|${job.output ?? ""}|${job.detail}`;
      if (terminalSignaturesRef.current.get(job.id) === signature) continue;
      terminalSignaturesRef.current.set(job.id, signature);
      additions.push({
        id: Date.now() + additions.length,
        source: job.path,
        time: new Date().toISOString(),
        output: job.output,
        error: job.status === "failed" || !job.output ? job.detail : undefined,
      });
    }
    if (additions.length > 0) {
      setHistory((current) => [...additions.reverse(), ...current].slice(0, 500));
    }
  }, [jobs]);

  useEffect(() => {
    if (!IS_TAURI) {
      setLibreOfficePath(null);
      return;
    }
    invoke<{ libreoffice: string | null }>("conversion_engine_status")
      .then((status) => setLibreOfficePath(status.libreoffice))
      .catch(() => setLibreOfficePath(null));
  }, []);

  useEffect(() => {
    if (!IS_TAURI) return;
    let dispose: (() => void) | undefined;
    getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop") return;
      const files = await invoke<LocalFile[]>("expand_dropped_paths", { paths: event.payload.paths });
      addPaths(files.map((file) => file.path));
    }).then((unlisten) => { dispose = unlisten; });
    return () => dispose?.();
  }, []);

  function addPaths(paths: string[]) {
    if (paths.length === 0) return;
    const existing = new Set(jobsRef.current.map((job) => job.path.toLowerCase()));
    const now = Date.now();
    const added: Job[] = paths.filter((path) => !existing.has(path.toLowerCase())).map((path, index) => ({
      id: now + index,
      name: fileName(path),
      path,
      kind: jobKind(path),
      status: "waiting",
      progress: 0,
      detail: "已加入本地队列",
    }));
    if (added.length === 0) return;
    jobsRef.current = [...jobsRef.current, ...added];
    setJobs((current) => [...current, ...added]);
    setSelectedId(added[0].id);
  }

  async function chooseFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "支持的文件", extensions: ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md", "markdown", "html", "htm", "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "mp3", "mp4"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    addPaths(paths);
  }

  async function chooseFolder() {
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return;
    try {
      const files = await invoke<LocalFile[]>("list_supported_files", { directory: selected });
      addPaths(files.map((file) => file.path));
    } catch (error) {
      setJobs((current) => [...current, { id: Date.now(), name: fileName(selected), path: selected, kind: "文件夹", status: "failed", progress: 0, detail: String(error) }]);
    }
  }

  function moveSelected(offset: -1 | 1) {
    if (selectedId === null) return;
    setJobs((current) => {
      const index = current.findIndex((job) => job.id === selectedId);
      const target = index + offset;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeSelected() {
    if (selectedId === null) return;
    setJobs((current) => current.filter((job) => job.id !== selectedId));
    setSelectedId(null);
  }

  async function mergeImages() {
    if (imageJobs.length === 0) return;
    const destination = await save({ defaultPath: "合并图片.pdf", filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    const imageIds = new Set(imageJobs.map((job) => job.id));
    setJobs((current) => current.map((job) => imageIds.has(job.id) ? { ...job, status: "running", progress: 40, detail: "正在生成 PDF" } : job));
    try {
      const output = await invoke<string>("merge_images_to_pdf", { sources: imageJobs.map((job) => job.path), destination });
      setJobs((current) => current.map((job) => imageIds.has(job.id) ? { ...job, status: "completed", progress: 100, detail: "转换完成", output } : job));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setJobs((current) => current.map((job) => imageIds.has(job.id) ? { ...job, status: "failed", progress: 0, detail } : job));
    }
  }

  async function createScanStylePdf() {
    if (imageJobs.length === 0) return;
    const destination = await save({ defaultPath: "扫描件风格.pdf", filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    const ids = new Set(imageJobs.map((job) => job.id));
    setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "running", progress: 35, detail: "正在增强对比度并生成扫描件风格 PDF" } : job));
    try {
      const output = await invoke<string>("images_to_scan_pdf", { sources: imageJobs.map((job) => job.path), destination });
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "completed", progress: 100, detail: "扫描件风格 PDF 已生成", output } : job));
    } catch (error) {
      const detail = String(error);
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "failed", progress: 0, detail } : job));
    }
  }

  async function convertQueueToPdf() {
    if (toPdfJobs.length === 0) return;
    const destination = await save({ defaultPath: toPdfJobs.length === 1 ? `${toPdfJobs[0].name.replace(/\.[^.]+$/, "")}.pdf` : "合并转换.pdf", filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    const ids = new Set(toPdfJobs.map((job) => job.id));
    setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "running", progress: 35, detail: "正在按队列顺序转成 PDF" } : job));
    try {
      const output = await invoke<string>("files_to_pdf", { sources: toPdfJobs.map((job) => job.path), destination });
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "completed", progress: 100, detail: "已转成 PDF", output } : job));
    } catch (error) {
      const detail = String(error);
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "failed", progress: 0, detail } : job));
    }
  }

  async function selectOutputFolder() {
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return null;
    setOutputFolder(selected);
    return selected;
  }

  async function runBatchPdf() {
    if (batchStatus === "running" || batchStatus === "paused") return;
    const candidates = jobs.filter((job) => TO_PDF_EXTENSIONS.has(extension(job.path)));
    if (candidates.length === 0) return;
    const folder = outputFolder || await selectOutputFolder();
    if (!folder) return;
    try {
      await invoke<number>("validate_batch_inputs", { sources: candidates.map((job) => job.path) });
    } catch (error) {
      candidates.forEach((job) => updateJob(job.id, { status: "failed", detail: String(error), progress: 0 }));
      return;
    }
    pauseRef.current = false;
    cancelRef.current = false;
    setBatchStatus("running");
    for (let index = 0; index < candidates.length; index += 1) {
      const job = candidates[index];
      while (pauseRef.current && !cancelRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
      if (cancelRef.current) {
        candidates.slice(index).forEach((item) => updateJob(item.id, { status: "cancelled", progress: 0, detail: "批量任务已取消" }));
        break;
      }
      updateJob(job.id, { status: "running", progress: 20, detail: `正在处理 ${index + 1} / ${candidates.length}` });
      const baseName = job.name.replace(/\.[^.]+$/, "");
      const requestedName = `${namingRule.split("{name}").join(baseName).split("{index}").join(String(index + 1).padStart(3, "0")) || baseName}.pdf`;
      try {
        const destination = await invoke<string>("resolve_output_path", { directory: folder, fileName: requestedName, conflict: conflictPolicy });
        const output = await invoke<string>("files_to_pdf", { sources: [job.path], destination });
        updateJob(job.id, { status: "completed", progress: 100, detail: "批量转换完成", output });
      } catch (error) {
        const detail = String(error);
        if (detail.includes("SKIP_EXISTS")) {
          updateJob(job.id, { status: "completed", progress: 100, detail: "已跳过：输出文件已存在" });
        } else {
          updateJob(job.id, { status: "failed", progress: 0, detail });
        }
      }
    }
    setBatchStatus(cancelRef.current ? "cancelled" : "idle");
  }

  function togglePause() {
    const paused = !pauseRef.current;
    pauseRef.current = paused;
    setBatchStatus(paused ? "paused" : "running");
    setJobs((current) => current.map((job) => job.status === "waiting" || job.status === "paused" ? { ...job, status: paused ? "paused" : "waiting", detail: paused ? "批量队列已暂停" : "等待继续处理" } : job));
  }

  function cancelBatch() {
    cancelRef.current = true;
    pauseRef.current = false;
    setBatchStatus("cancelled");
  }

  function retryFailed() {
    setJobs((current) => current.map((job) => job.status === "failed" || job.status === "cancelled" ? { ...job, status: "waiting", progress: 0, detail: "等待重试" } : job));
  }

  function updateJob(id: number, patch: Partial<Job>) {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, ...patch } : job));
  }

  async function mergeQueuedPdfs() {
    if (pdfJobs.length === 0) return;
    const destination = await save({ defaultPath: "合并文档.pdf", filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    const ids = new Set(pdfJobs.map((job) => job.id));
    setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "running", progress: 40, detail: "正在合并 PDF" } : job));
    try {
      const output = await invoke<string>("merge_pdfs", { sources: pdfJobs.map((job) => job.path), destination });
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "completed", progress: 100, detail: "PDF 合并完成", output } : job));
    } catch (error) {
      const detail = String(error);
      setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "failed", progress: 0, detail } : job));
    }
  }

  async function runSelectedPdfAction(action: "split_pdf" | "encrypt_pdf" | "decrypt_pdf") {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const isSplit = action === "split_pdf";
    const destination = await save({
      defaultPath: isSplit ? `${selectedJob.name.replace(/\.pdf$/i, "")}_拆分.zip` : `${selectedJob.name.replace(/\.pdf$/i, "")}_${action === "encrypt_pdf" ? "加密" : "解密"}.pdf`,
      filters: [{ name: isSplit ? "ZIP 压缩包" : "PDF 文档", extensions: [isSplit ? "zip" : "pdf"] }],
    });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 40, detail: "正在本地处理 PDF" });
    try {
      const args = action === "split_pdf"
        ? { source: selectedJob.path, destination, every: pagesPerFile, password: password || null }
        : { source: selectedJob.path, destination, password };
      const output = await invoke<string>(action, args);
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: "处理完成", output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function exportSelectedText(format: "text" | "markdown") {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const extension = format === "markdown" ? "md" : "txt";
    const destination = await save({ defaultPath: `${selectedJob.name.replace(/\.pdf$/i, "")}.${extension}`, filters: [{ name: format === "markdown" ? "Markdown" : "文本", extensions: [extension] }] });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 40, detail: "正在提取电子文字" });
    try {
      const output = await invoke<string>("pdf_to_text", { source: selectedJob.path, destination, format, password: password || null });
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: `已导出 ${extension.toUpperCase()}`, output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function exportSelectedPdf(format: "images" | "word") {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const isImages = format === "images";
    const destination = await save({
      defaultPath: `${selectedJob.name.replace(/\.pdf$/i, "")}${isImages ? "_图片.zip" : ".docx"}`,
      filters: [{ name: isImages ? "ZIP 图片包" : "Word 文档", extensions: [isImages ? "zip" : "docx"] }],
    });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 35, detail: isImages ? "正在逐页渲染图片" : "正在还原 Word 版式" });
    try {
      const output = isImages
        ? await invoke<string>("pdf_to_images", { source: selectedJob.path, destination, dpi: imageDpi, format: "png", password: password || null })
        : await invoke<string>("pdf_to_word", { source: selectedJob.path, destination, password: password || null });
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: isImages ? "已导出逐页图片 ZIP" : "已导出 Word", output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function runOcr(format: "text" | "markdown" | "docx" | "searchable-pdf") {
    if (!selectedJob || (!isPdf(selectedJob.path) && !isImage(selectedJob.path))) return;
    const extensionMap = { text: "txt", markdown: "md", docx: "docx", "searchable-pdf": "pdf" } as const;
    const suffix = extensionMap[format];
    const destination = await save({
      defaultPath: `${selectedJob.name.replace(/\.[^.]+$/, "")}_OCR.${suffix}`,
      filters: [{ name: format === "searchable-pdf" ? "可搜索 PDF" : `OCR ${suffix.toUpperCase()}`, extensions: [suffix] }],
    });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 30, detail: "正在离线 OCR（中英文）" });
    try {
      const output = await invoke<string>("ocr_document", { source: selectedJob.path, destination, format, password: password || null, minConfidence: ocrConfidence / 100 });
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: `OCR 已导出 ${suffix.toUpperCase()}`, output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function exportSelectedExcel() {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const destination = await save({ defaultPath: `${selectedJob.name.replace(/\.pdf$/i, "")}_表格.xlsx`, filters: [{ name: "Excel 工作簿", extensions: ["xlsx"] }] });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 30, detail: "正在提取表格与 Raw 坐标数据" });
    try {
      const output = await invoke<string>("pdf_to_excel", { source: selectedJob.path, destination, password: password || null, minConfidence: ocrConfidence / 100 });
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: "已导出 Excel；请检查低置信度批注和 Raw 表", output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function exportSelectedPpt() {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const destination = await save({ defaultPath: `${selectedJob.name.replace(/\.pdf$/i, "")}.pptx`, filters: [{ name: "PowerPoint 演示文稿", extensions: ["pptx"] }] });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 30, detail: "正在按页生成视觉一致的幻灯片" });
    try {
      const output = await invoke<string>("pdf_to_ppt", { source: selectedJob.path, destination, password: password || null, dpi: Math.min(300, Math.max(96, imageDpi)) });
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: "已导出图片型 PPT（元素不可编辑）", output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  async function runPdfUtility(action: "organize_pdf" | "compress_pdf" | "stamp_pdf") {
    if (!selectedJob || !isPdf(selectedJob.path)) return;
    const label = action === "organize_pdf" ? "整理" : action === "compress_pdf" ? "压缩" : "水印页码";
    const destination = await save({ defaultPath: `${selectedJob.name.replace(/\.pdf$/i, "")}_${label}.pdf`, filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    updateJob(selectedJob.id, { status: "running", progress: 35, detail: `正在${label} PDF` });
    try {
      const args = action === "organize_pdf"
        ? { source: selectedJob.path, destination, pages: pageSpec || null, rotate: rotation, password: password || null }
        : action === "stamp_pdf"
          ? { source: selectedJob.path, destination, watermark: watermark || null, pageNumbers, password: password || null }
          : { source: selectedJob.path, destination, password: password || null };
      const output = await invoke<string>(action, args);
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: `${label}完成`, output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  return (
    <main className="app">
      <aside>
        <div className="brand">F <span><b>FNT Local Docs</b><small>本地文档工作台</small></span></div>
        <button className="primary" onClick={chooseFiles}>＋ 添加文件</button>
        <button className="secondary-wide" onClick={chooseFolder}>＋ 添加整个文件夹</button>
        <nav><b>转换队列 <i>{jobs.length}</i></b><b>本地历史 <i>{history.length}</i></b></nav>
        <p className="safe">● 文件仅在此设备处理<br />不会上传至服务器<br /><span className={libreOfficePath ? "engine-ok" : "engine-missing"}>LibreOffice：{libreOfficePath === undefined ? "检测中" : libreOfficePath ? "已就绪" : "未安装"}</span>{libreOfficePath === null ? <button onClick={() => openUrl("https://www.libreoffice.org/download/download-libreoffice/")}>安装转换引擎</button> : null}</p>
      </aside>
      <section className="work">
        <header><div><small>工作台 / 转换队列</small><h1>本地转换任务</h1></div><div className="header-actions"><button className="primary" onClick={runBatchPdf} disabled={toPdfJobs.length === 0 || batchStatus === "running" || batchStatus === "paused"}>批量转成 PDF</button><button onClick={togglePause} disabled={batchStatus !== "running" && batchStatus !== "paused"}>{batchStatus === "paused" ? "继续" : "暂停"}</button><button onClick={cancelBatch} disabled={batchStatus !== "running" && batchStatus !== "paused"}>取消</button><button onClick={mergeQueuedPdfs} disabled={pdfJobs.length === 0}>合并 PDF</button><button onClick={mergeImages} disabled={imageJobs.length === 0}>仅合并图片</button><button onClick={createScanStylePdf} disabled={imageJobs.length === 0}>扫描件风格</button></div></header>
        <div className="cards"><p>队列任务<strong>{jobs.length}</strong><small>{completedCount} 个已完成</small></p><p>图片 / PDF<strong>{imageJobs.length} / {pdfJobs.length}</strong><small>输出顺序跟随队列</small></p><p>处理模式<strong>离线</strong><small>文件不上传服务器</small></p></div>
        <button className="drop" onClick={chooseFiles}><b>选择文件</b><span>图片、TXT、Markdown 可直接转 PDF；Office、CSV、HTML 使用本机 LibreOffice</span><em>浏览本机</em></button>
        <section className="batch-settings"><label>输出文件夹<input value={outputFolder} readOnly placeholder="首次批量处理时选择" /></label><button onClick={selectOutputFolder}>选择</button><label>命名规则<input value={namingRule} onChange={(event) => setNamingRule(event.currentTarget.value)} placeholder="{name}_{index}" /></label><label>同名文件<select value={conflictPolicy} onChange={(event) => setConflictPolicy(event.currentTarget.value as "rename" | "overwrite" | "skip")}><option value="rename">自动重命名</option><option value="overwrite">覆盖</option><option value="skip">跳过</option></select></label></section>
        <div className="queue-heading"><h2>转换队列</h2><div><button onClick={() => moveSelected(-1)} disabled={!selectedJob}>上移</button><button onClick={() => moveSelected(1)} disabled={!selectedJob}>下移</button><button onClick={removeSelected} disabled={!selectedJob}>移除</button><button onClick={retryFailed} disabled={!jobs.some((job) => job.status === "failed" || job.status === "cancelled")}>重试失败项</button></div></div>
        {jobs.length === 0 ? <div className="empty">添加图片后即可生成第一个本地 PDF。</div> : jobs.map((job) => (
          <button className={job.id === selectedId ? "job on" : "job"} key={job.id} onClick={() => setSelectedId(job.id)}>
            <strong>{isImage(job.path) ? "IMG" : "DOC"}</strong><span><b>{job.name}</b><small>{job.kind}</small>{job.progress > 0 && job.progress < 100 ? <i><em style={{ width: `${job.progress}%` }} /></i> : null}</span><label className={job.status}>{STATUS_LABEL[job.status]}<small>{job.detail}</small></label>
          </button>
        ))}
        <details className="history"><summary>本地转换历史（{history.length}）</summary><div className="history-head"><small>仅保存在本机，最多 500 条</small><button onClick={() => setHistory([])} disabled={history.length === 0}>清空历史</button></div>{history.length === 0 ? <p>暂无历史记录。</p> : history.slice(0, 50).map((entry) => <article key={entry.id}><b>{fileName(entry.source)}</b><small>{new Date(entry.time).toLocaleString()} · {entry.source}</small><span className={entry.error ? "history-error" : "history-output"}>{entry.error ?? entry.output}</span>{entry.output ? <button onClick={() => openPath(entry.output!)}>打开</button> : null}</article>)}</details>
      </section>
      <aside className="preview"><div><small>结果与详情</small><b>{selectedJob?.name ?? "尚未选择文件"}</b></div><article><b>FNT</b><h3>{selectedJob?.kind ?? "本地文档转换"}</h3><p>{selectedJob?.detail ?? "从左侧添加文件开始。"}</p><FilePreview path={selectedJob?.output ?? selectedJob?.path} />{selectedJob && isPdf(selectedJob.path) ? <section className="pdf-tools"><label>每组页数<input type="number" min="1" value={pagesPerFile} onChange={(event) => setPagesPerFile(Math.max(1, Number(event.currentTarget.value) || 1))} /></label><label>图片 / PPT 导出 DPI<input type="number" min="72" max="600" value={imageDpi} onChange={(event) => setImageDpi(Math.min(600, Math.max(72, Number(event.currentTarget.value) || 150)))} /></label><label>PDF 密码<input type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="加密或解密时填写" /></label><div><button onClick={() => exportSelectedText("text")}>导出 TXT</button><button onClick={() => exportSelectedText("markdown")}>导出 Markdown</button><button onClick={() => exportSelectedPdf("images")}>导出图片 ZIP</button><button onClick={() => exportSelectedPdf("word")}>导出 Word</button><button onClick={exportSelectedExcel}>导出 Excel</button><button onClick={exportSelectedPpt}>导出 PPT</button><button onClick={() => runSelectedPdfAction("split_pdf")}>拆分 ZIP</button><button onClick={() => runSelectedPdfAction("encrypt_pdf")} disabled={!password}>AES-256 加密</button><button onClick={() => runSelectedPdfAction("decrypt_pdf")} disabled={!password}>密码解密</button></div><label>页码范围 / 顺序<input value={pageSpec} onChange={(event) => setPageSpec(event.currentTarget.value)} placeholder="如 3,1,2,5-8；留空表示全部" /></label><label>统一旋转<select value={rotation} onChange={(event) => setRotation(Number(event.currentTarget.value))}><option value={0}>不旋转</option><option value={90}>顺时针 90°</option><option value={180}>180°</option><option value={270}>顺时针 270°</option></select></label><label>水印文字<input value={watermark} onChange={(event) => setWatermark(event.currentTarget.value)} placeholder="可留空，仅添加页码" /></label><label className="check"><input type="checkbox" checked={pageNumbers} onChange={(event) => setPageNumbers(event.currentTarget.checked)} /> 添加页码</label><div><button onClick={() => runPdfUtility("organize_pdf")}>提取 / 重排 / 旋转</button><button onClick={() => runPdfUtility("compress_pdf")}>压缩 PDF</button><button onClick={() => runPdfUtility("stamp_pdf")} disabled={!watermark && !pageNumbers}>添加水印 / 页码</button></div></section> : null}{selectedJob && (isPdf(selectedJob.path) || isImage(selectedJob.path)) ? <section className="pdf-tools"><label>低置信度阈值（%）<input type="number" min="50" max="99" value={ocrConfidence} onChange={(event) => setOcrConfidence(Math.min(99, Math.max(50, Number(event.currentTarget.value) || 80)))} /></label><div><button onClick={() => runOcr("text")}>OCR → TXT</button><button onClick={() => runOcr("markdown")}>OCR → Markdown</button><button onClick={() => runOcr("docx")}>OCR → Word</button><button onClick={() => runOcr("searchable-pdf")}>生成可搜索 PDF</button></div></section> : null}<hr /><p className="path">{selectedJob?.output ?? selectedJob?.path ?? "预览不会将文件发送到网络。"}</p></article><footer><span>{selectedJob ? STATUS_LABEL[selectedJob.status] : "空队列"}</span><div>{selectedJob?.output ? <button onClick={() => openPath(selectedJob.output!)}>打开结果</button> : null}{outputFolder ? <button onClick={() => openPath(outputFolder)}>打开输出文件夹</button> : null}<button className="primary" onClick={convertQueueToPdf} disabled={toPdfJobs.length === 0}>合并转 PDF</button></div></footer></aside>
    </main>
  );
}
