import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { AboutContent, GuideContent, HomeToolBoard, QuickStartPicker, SettingsContent, ToolGrid, WelcomeGuide } from "./components/ProductUi";
import { BRAND } from "./brand";
import { GROUP_COPY, TOOLS, type ToolId, type ViewId } from "./product";
import "./App.css";

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
  toolId?: ToolId;
};
type HistoryEntry = { id: number; source: string; time: string; output?: string; error?: string };
type LocalFile = { path: string; size: number };
type ToastMessage = { id: number; kind: "success" | "error"; title: string; detail: string; path: string };
type WatermarkPosition = "top-left" | "top-center" | "top-right" | "center-left" | "center" | "center-right" | "bottom-left" | "bottom-center" | "bottom-right";
type AppSettings = {
  outputFolder: string;
  libreOfficeOverride: string;
  tempDirectory: string;
  namingRule: string;
  conflictPolicy: "rename" | "overwrite" | "skip";
  ocrConfidence: number;
  imageDpi: number;
  autoOpenResult: boolean;
};

const STORAGE_KEY = "fnt.queue.v2";
const HISTORY_KEY = "fnt.history.v1";
const GUIDE_KEY = "fnt.guide.seen.v3";
const SETTINGS_KEY = "docbox.settings.v1";
const SIDEBAR_KEY = "docbox.sidebar.collapsed.v1";
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

function jobStatusText(job: Job) {
  if (job.status === "running") return `处理中 ${job.progress}%`;
  if (job.status === "waiting") return "等待处理";
  if (job.status === "paused") return `已暂停 ${job.progress}%`;
  if (job.status === "completed") return "处理完成";
  if (job.status === "failed") return "处理失败";
  return "已取消";
}

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

const DEFAULT_SETTINGS: AppSettings = {
  outputFolder: "",
  libreOfficeOverride: "",
  tempDirectory: "",
  namingRule: "{name}",
  conflictPolicy: "rename",
  ocrConfidence: 80,
  imageDpi: 150,
  autoOpenResult: true,
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...(JSON.parse(saved) as Partial<AppSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
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

function toolMatchesPath(toolId: ToolId, path: string) {
  const suffix = extension(path);
  if (["mixed-pdf", "batch-pdf"].includes(toolId)) return TO_PDF_EXTENSIONS.has(suffix);
  if (toolId === "word-pdf") return ["doc", "docx"].includes(suffix);
  if (toolId === "ppt-pdf") return ["ppt", "pptx"].includes(suffix);
  if (toolId === "sheet-pdf") return ["xls", "xlsx", "csv"].includes(suffix);
  if (toolId === "text-pdf") return ["txt", "md", "markdown"].includes(suffix);
  if (toolId === "html-pdf") return ["html", "htm"].includes(suffix);
  if (["images-pdf", "scan-pdf"].includes(toolId)) return isImage(path);
  if (toolId.startsWith("ocr-")) return isPdf(path) || isImage(path);
  return isPdf(path);
}

const INITIAL_JOBS = loadJobs();
const INITIAL_HISTORY = loadHistory();
const INITIAL_SETTINGS = loadSettings();

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
  const [view, setView] = useState<ViewId>("home");
  const [activeToolId, setActiveToolId] = useState<ToolId>("mixed-pdf");
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem(GUIDE_KEY) !== "1");
  const [showQuickPicker, setShowQuickPicker] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(INITIAL_JOBS[0]?.id ?? null);
  const [pagesPerFile, setPagesPerFile] = useState(1);
  const [imageDpi, setImageDpi] = useState(INITIAL_SETTINGS.imageDpi);
  const [ocrConfidence, setOcrConfidence] = useState(INITIAL_SETTINGS.ocrConfidence);
  const [pageSpec, setPageSpec] = useState("");
  const [rotation, setRotation] = useState(0);
  const [watermark, setWatermark] = useState("");
  const [watermarkImage, setWatermarkImage] = useState("");
  const [watermarkLayout, setWatermarkLayout] = useState<"single" | "grid">("grid");
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>("center");
  const [watermarkCount, setWatermarkCount] = useState(12);
  const [watermarkSize, setWatermarkSize] = useState(34);
  const [watermarkOpacity, setWatermarkOpacity] = useState(18);
  const [watermarkAngle, setWatermarkAngle] = useState(-35);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [outputFolder, setOutputFolder] = useState(INITIAL_SETTINGS.outputFolder);
  const [libreOfficeOverride, setLibreOfficeOverride] = useState(INITIAL_SETTINGS.libreOfficeOverride);
  const [tempDirectory, setTempDirectory] = useState(INITIAL_SETTINGS.tempDirectory);
  const [namingRule, setNamingRule] = useState(INITIAL_SETTINGS.namingRule);
  const [conflictPolicy, setConflictPolicy] = useState<"rename" | "overwrite" | "skip">(INITIAL_SETTINGS.conflictPolicy);
  const [autoOpenResult, setAutoOpenResult] = useState(INITIAL_SETTINGS.autoOpenResult);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [batchStatus, setBatchStatus] = useState<"idle" | "running" | "paused" | "cancelled">("idle");
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const jobsRef = useRef(jobs);
  const activeToolIdRef = useRef(activeToolId);
  const terminalSignaturesRef = useRef(new Map(
    INITIAL_JOBS
      .filter((job) => job.status === "completed" || job.status === "failed")
      .map((job) => [job.id, `${job.status}|${job.output ?? ""}|${job.detail}`]),
  ));
  const revealedOutputsRef = useRef(new Set(INITIAL_JOBS.flatMap((job) => job.output ? [job.output] : [])));
  const pendingRevealRef = useRef(new Set<string>());
  const [password, setPassword] = useState("");
  const [libreOfficePath, setLibreOfficePath] = useState<string | null | undefined>(undefined);
  const activeTool = TOOLS.find((tool) => tool.id === activeToolId) ?? TOOLS[0];
  const selectedJob = jobs.find((job) => job.id === selectedId);
  const activeToolJobs = useMemo(() => jobs.filter((job) => job.toolId ? job.toolId === activeToolId : toolMatchesPath(activeToolId, job.path)), [activeToolId, jobs]);
  const activeInputJobs = useMemo(() => activeToolJobs.filter((job) => toolMatchesPath(activeToolId, job.path)), [activeToolId, activeToolJobs]);
  const imageJobs = useMemo(() => activeInputJobs.filter((job) => isImage(job.path)), [activeInputJobs]);
  const pdfJobs = useMemo(() => activeInputJobs.filter((job) => isPdf(job.path)), [activeInputJobs]);
  const completedCount = useMemo(() => jobs.filter((job) => job.status === "completed").length, [jobs]);
  const toPdfJobs = useMemo(() => activeInputJobs.filter((job) => TO_PDF_EXTENSIONS.has(extension(job.path))), [activeInputJobs]);
  const activeProgress = activeInputJobs.length === 0 ? 0 : Math.round(activeInputJobs.reduce((sum, job) => sum + job.progress, 0) / activeInputJobs.length);
  const activeFailures = activeInputJobs.filter((job) => job.status === "failed").length;
  const hasRunningJobs = jobs.some((job) => job.status === "running");
  const waitingCount = jobs.filter((job) => job.status === "waiting" || job.status === "paused").length;
  const failedCount = jobs.filter((job) => job.status === "failed" || job.status === "cancelled").length;
  const processingCount = jobs.filter((job) => job.status === "running").length;
  const queueProgress = jobs.length === 0 ? 0 : Math.round(jobs.reduce((sum, job) => sum + job.progress, 0) / jobs.length);
  const sidebarJobs = useMemo(() => [...jobs].sort((left, right) => {
    const order: Record<JobStatus, number> = { running: 0, paused: 1, waiting: 2, failed: 3, cancelled: 4, completed: 5 };
    return order[left.status] - order[right.status] || right.id - left.id;
  }).slice(0, 3), [jobs]);
  const canRunActiveTool = activeTool.requirement === "image"
    ? imageJobs.length > 0
    : activeTool.requirement === "pdf"
      ? Boolean(selectedJob && toolMatchesPath(activeToolId, selectedJob.path))
      : activeTool.requirement === "ocr"
        ? Boolean(selectedJob && toolMatchesPath(activeToolId, selectedJob.path))
        : activeInputJobs.length > 0;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    activeToolIdRef.current = activeToolId;
  }, [activeToolId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(".main-content")?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, activeToolId]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 500)));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      outputFolder,
      libreOfficeOverride,
      tempDirectory,
      namingRule,
      conflictPolicy,
      ocrConfidence,
      imageDpi,
      autoOpenResult,
    } satisfies AppSettings));
  }, [autoOpenResult, conflictPolicy, imageDpi, libreOfficeOverride, namingRule, ocrConfidence, outputFolder, tempDirectory]);

  useEffect(() => {
    const additions: HistoryEntry[] = [];
    for (const job of jobs) {
      if (job.status !== "completed" && job.status !== "failed") {
        terminalSignaturesRef.current.delete(job.id);
        continue;
      }
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
      const latest = additions[additions.length - 1];
      setHistory((current) => [...additions.slice().reverse(), ...current].slice(0, 500));
      setToast({
        id: Date.now(),
        kind: latest.error ? "error" : "success",
        title: latest.error ? "处理失败" : "转换成功",
        detail: latest.error || "结果已经保存到电脑。",
        path: latest.output || latest.source,
      });
    }
  }, [jobs]);

  useEffect(() => {
    for (const job of jobs) {
      if (job.status === "completed" && job.output && !revealedOutputsRef.current.has(job.output)) {
        pendingRevealRef.current.add(job.output);
      } else if (job.status !== "completed" && job.output) {
        revealedOutputsRef.current.delete(job.output);
        pendingRevealRef.current.delete(job.output);
      }
    }
    if (!autoOpenResult) {
      pendingRevealRef.current.forEach((path) => revealedOutputsRef.current.add(path));
      pendingRevealRef.current.clear();
      return;
    }
    if (!IS_TAURI || batchStatus === "running" || batchStatus === "paused" || hasRunningJobs) return;
    const pending = Array.from(pendingRevealRef.current);
    const latest = pending[pending.length - 1];
    pending.forEach((path) => revealedOutputsRef.current.add(path));
    pendingRevealRef.current.clear();
    if (latest) invoke("reveal_path", { path: latest }).catch(() => undefined);
  }, [autoOpenResult, batchStatus, hasRunningJobs, jobs]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast((current) => current?.id === toast.id ? null : current), toast.kind === "error" ? 10000 : 7000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!hasRunningJobs) return;
    const interval = window.setInterval(() => {
      setJobs((current) => current.map((job) => job.status === "running" && job.progress < 92
        ? { ...job, progress: Math.min(92, job.progress + Math.max(1, Math.round((92 - job.progress) / 9))) }
        : job));
    }, 550);
    return () => window.clearInterval(interval);
  }, [hasRunningJobs]);

  useEffect(() => {
    if (!IS_TAURI) {
      setLibreOfficePath(null);
      return;
    }
    invoke("configure_resource_paths", {
      libreofficePath: libreOfficeOverride || null,
      tempDirectory: tempDirectory || null,
    }).then(() => invoke<{ libreoffice: string | null }>("conversion_engine_status"))
      .then((status) => setLibreOfficePath(status.libreoffice))
      .catch(() => setLibreOfficePath(null));
  }, [libreOfficeOverride, tempDirectory]);

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
    const targetToolId = activeToolIdRef.current;
    const existing = new Set(jobsRef.current.map((job) => `${job.toolId ?? targetToolId}|${job.path.toLowerCase()}`));
    const now = Date.now();
    const added: Job[] = paths.filter((path) => !existing.has(`${targetToolId}|${path.toLowerCase()}`)).map((path, index) => ({
      id: now + index,
      name: fileName(path),
      path,
      kind: jobKind(path),
      toolId: targetToolId,
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
    if (!selected) return [];
    const paths = Array.isArray(selected) ? selected : [selected];
    addPaths(paths);
    return paths;
  }

  function quickStart() {
    setShowQuickPicker(true);
  }

  function openQueuedJob(job: Job) {
    setSelectedId(job.id);
    if (job.toolId) {
      activeToolIdRef.current = job.toolId;
      setActiveToolId(job.toolId);
      setView("workspace");
      return;
    }
    setView("batch");
  }

  function toggleSidebar() {
    setSidebarCollapsed((collapsed) => {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "0" : "1");
      return !collapsed;
    });
  }

  async function chooseFolder() {
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return;
    try {
      const files = await invoke<LocalFile[]>("list_supported_files", { directory: selected });
      addPaths(files.map((file) => file.path));
    } catch (error) {
      setJobs((current) => [...current, { id: Date.now(), name: fileName(selected), path: selected, kind: "文件夹", toolId: activeToolIdRef.current, status: "failed", progress: 0, detail: String(error) }]);
    }
  }

  function moveJob(id: number, offset: -1 | 1) {
    setJobs((current) => {
      const index = current.findIndex((job) => job.id === id);
      if (index < 0) return current;
      const source = current[index];
      const relatedIndexes = current.flatMap((job, jobIndex) => {
        const sameTool = source.toolId
          ? job.toolId === source.toolId
          : !job.toolId && toolMatchesPath(activeToolIdRef.current, job.path);
        return sameTool ? [jobIndex] : [];
      });
      const visibleIndex = relatedIndexes.indexOf(index);
      const target = relatedIndexes[visibleIndex + offset];
      if (target === undefined) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedId(id);
  }

  function removeJob(id: number) {
    setJobs((current) => current.filter((job) => job.id !== id));
    setSelectedId((current) => current === id ? null : current);
  }

  function retryJob(id: number) {
    updateJob(id, { status: "waiting", progress: 0, detail: "等待重新运行", output: undefined });
    setSelectedId(id);
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

  async function convertQueueToPdf(sourceJobs = toPdfJobs) {
    if (sourceJobs.length === 0) return;
    const destination = await save({ defaultPath: sourceJobs.length === 1 ? `${sourceJobs[0].name.replace(/\.[^.]+$/, "")}.pdf` : "合并转换.pdf", filters: [{ name: "PDF 文档", extensions: ["pdf"] }] });
    if (!destination) return;
    const ids = new Set(sourceJobs.map((job) => job.id));
    setJobs((current) => current.map((job) => ids.has(job.id) ? { ...job, status: "running", progress: 35, detail: "正在按队列顺序转成 PDF" } : job));
    try {
      const output = await invoke<string>("files_to_pdf", { sources: sourceJobs.map((job) => job.path), destination });
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

  async function selectLibreOfficePath() {
    const selected = await open({ multiple: false, directory: false, filters: [{ name: "LibreOffice 程序", extensions: ["exe"] }] });
    if (!selected || Array.isArray(selected)) return;
    setLibreOfficeOverride(selected);
  }

  async function selectTempDirectory() {
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return;
    setTempDirectory(selected);
  }

  async function selectWatermarkImage() {
    const selected = await open({ multiple: false, directory: false, filters: [{ name: "水印图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"] }] });
    if (!selected || Array.isArray(selected)) return;
    setWatermarkImage(selected);
  }

  function applyWatermarkPreset(preset: "center" | "corners" | "fill") {
    if (preset === "center") {
      setWatermarkLayout("single"); setWatermarkPosition("center"); setWatermarkCount(1); setWatermarkSize(46); setWatermarkOpacity(16); setWatermarkAngle(-25);
    } else if (preset === "corners") {
      setWatermarkLayout("grid"); setWatermarkCount(4); setWatermarkSize(30); setWatermarkOpacity(18); setWatermarkAngle(-30);
    } else {
      setWatermarkLayout("grid"); setWatermarkCount(12); setWatermarkSize(34); setWatermarkOpacity(18); setWatermarkAngle(-35);
    }
  }

  async function runBatchPdf() {
    if (batchStatus === "running" || batchStatus === "paused") return;
    const candidates = toPdfJobs;
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
          ? { source: selectedJob.path, destination, watermark: watermark || null, watermarkImage: watermarkImage || null, watermarkPosition, watermarkCount: watermarkLayout === "single" ? 1 : watermarkCount, watermarkSize, watermarkOpacity: watermarkOpacity / 100, watermarkAngle, pageNumbers, password: password || null }
          : { source: selectedJob.path, destination, password: password || null };
      const output = await invoke<string>(action, args);
      updateJob(selectedJob.id, { status: "completed", progress: 100, detail: `${label}完成`, output });
    } catch (error) {
      updateJob(selectedJob.id, { status: "failed", progress: 0, detail: String(error) });
    }
  }

  function selectTool(id: ToolId) {
    activeToolIdRef.current = id;
    setActiveToolId(id);
    setSelectedId(jobsRef.current.find((job) => (job.toolId ? job.toolId === id : toolMatchesPath(id, job.path)) && toolMatchesPath(id, job.path))?.id ?? null);
    setView("workspace");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeWelcome(nextView?: ViewId) {
    setShowWelcome(false);
    if (nextView) setView(nextView);
  }

  function neverShowWelcome() {
    localStorage.setItem(GUIDE_KEY, "1");
    setShowWelcome(false);
  }

  async function runActiveTool() {
    switch (activeToolId) {
      case "mixed-pdf":
      case "word-pdf":
      case "ppt-pdf":
      case "sheet-pdf":
      case "text-pdf":
      case "html-pdf": await convertQueueToPdf(activeInputJobs); break;
      case "batch-pdf": await runBatchPdf(); break;
      case "images-pdf": await mergeImages(); break;
      case "scan-pdf": await createScanStylePdf(); break;
      case "pdf-word": await exportSelectedPdf("word"); break;
      case "pdf-excel": await exportSelectedExcel(); break;
      case "pdf-ppt": await exportSelectedPpt(); break;
      case "pdf-text": await exportSelectedText("text"); break;
      case "pdf-markdown": await exportSelectedText("markdown"); break;
      case "pdf-images": await exportSelectedPdf("images"); break;
      case "ocr-text": await runOcr("text"); break;
      case "ocr-markdown": await runOcr("markdown"); break;
      case "ocr-word": await runOcr("docx"); break;
      case "ocr-searchable": await runOcr("searchable-pdf"); break;
      case "merge-pdf": await mergeQueuedPdfs(); break;
      case "split-pdf": await runSelectedPdfAction("split_pdf"); break;
      case "organize-pdf": await runPdfUtility("organize_pdf"); break;
      case "compress-pdf": await runPdfUtility("compress_pdf"); break;
      case "stamp-pdf": await runPdfUtility("stamp_pdf"); break;
      case "encrypt-pdf": await runSelectedPdfAction("encrypt_pdf"); break;
      case "decrypt-pdf": await runSelectedPdfAction("decrypt_pdf"); break;
    }
  }

  const running = batchStatus === "running" || hasRunningJobs;
  const needsLibreOffice = ["mixed-pdf", "batch-pdf", "word-pdf", "ppt-pdf", "sheet-pdf", "html-pdf"].includes(activeToolId);
  const needsDpi = activeToolId === "pdf-images" || activeToolId === "pdf-ppt";
  const needsOcr = activeTool.group === "ocr" || activeToolId === "pdf-excel";
  const needsPassword = activeToolId === "encrypt-pdf" || activeToolId === "decrypt-pdf";
  const missingPassword = needsPassword && !password;
  const missingStamp = activeToolId === "stamp-pdf" && !watermark && !watermarkImage && !pageNumbers;
  const runDisabled = !canRunActiveTool || running || missingPassword || missingStamp;
  const saveActionLabel = activeToolId === "batch-pdf" ? "选择输出文件夹并开始" : "选择保存位置并开始";
  const nextStepTitle = running
    ? `正在处理 ${activeProgress}%`
    : activeToolJobs.length === 0
      ? "先添加需要处理的文件"
      : !canRunActiveTool
        ? "请选择符合当前工具格式的文件"
        : missingPassword
          ? `请先${activeToolId === "decrypt-pdf" ? "输入原 PDF 密码" : "设置 PDF 密码"}`
          : missingStamp
            ? "请先添加水印文字、图片或页码"
            : saveActionLabel;
  const nextStepDetail = running
    ? `${activeTool.title}正在本机处理，完成后会显示结果路径。`
    : activeToolJobs.length === 0
      ? `支持：${activeTool.accepts}`
      : runDisabled
        ? "完成上方缺少的内容后，主按钮会自动变为可用。"
        : activeToolId === "batch-pdf"
          ? "点击主按钮后选择输出文件夹，随后开始逐个处理。"
          : "点击主按钮会打开“另存为”窗口；确认文件名和位置后立即开始处理。";

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className={sidebarCollapsed ? "sidebar collapsed" : "sidebar"}>
        <div className="sidebar-control"><button onClick={toggleSidebar} title={sidebarCollapsed ? "展开侧栏" : "收起侧栏"}><span>{sidebarCollapsed ? "›" : "‹"}</span><b>{sidebarCollapsed ? "展开" : "收起侧栏"}</b></button></div>
        <nav className="main-nav" aria-label="主要功能">
          <button title="首页" className={view === "home" ? "active" : ""} onClick={() => setView("home")}><span>⌂</span><b>首页</b></button>
          <section className="task-nav-group">
            <header><span>任务管理</span></header>
            <button title="全部任务" className={view === "batch" ? "active" : ""} onClick={() => setView("batch")}><span>≡</span><b>全部任务</b><i>{jobs.length}</i></button>
            <button title="转换历史" className={view === "history" ? "active" : ""} onClick={() => setView("history")}><span>↻</span><b>转换历史</b><i>{history.length}</i></button>
          </section>
          <p>软件</p>
          <button title="设置" className={view === "settings" ? "active" : ""} onClick={() => setView("settings")}><span>⚙</span><b>设置</b></button>
          <button title="使用教程" className={view === "guide" ? "active" : ""} onClick={() => setView("guide")}><span>?</span><b>使用教程</b></button>
          <button title="关于与声明" className={view === "about" ? "active" : ""} onClick={() => setView("about")}><span>i</span><b>关于与声明</b></button>
        </nav>
        <div className="sidebar-bottom">
          <section className={`sidebar-runtime${running ? " running" : failedCount > 0 ? " warning" : ""}`} aria-label="最近任务">
            <header><i /><div><span>最近任务</span><b>{jobs.length === 0 ? "还没有任务" : running ? `${processingCount} 个正在处理` : `${jobs.length} 个任务`}</b></div></header>
            <div className="runtime-mini-list">
              {sidebarJobs.length === 0 ? <p className="runtime-empty">选择工具并添加文件后，任务会显示在这里。</p> : sidebarJobs.map((job) => (
                <button className={`runtime-job status-${job.status}`} key={job.id} onClick={() => openQueuedJob(job)} title={job.name}>
                  <span><b>{job.name}</b><small>{jobStatusText(job)}</small></span>
                  <i><em style={{ width: `${job.progress}%` }} /></i>
                </button>
              ))}
            </div>
            <button onClick={() => setView("batch")}>查看全部任务<span>→</span></button>
          </section>
        </div>
      </aside>

      <main className="main-content">
        <header className={`topbar topbar-${view}`}>
          <div className="topbar-path"><button onClick={() => setView("home")} aria-label="返回 DocBox 首页"><img src="/docbox-mark.png" alt="" /><span>DocBox</span></button><i>›</i><b>{view === "workspace" ? activeTool.title : view === "home" ? "首页" : view === "batch" ? "全部任务" : view === "history" ? "转换历史" : view === "settings" ? "设置" : view === "guide" ? "使用教程" : view === "about" ? "关于与声明" : GROUP_COPY[view as keyof typeof GROUP_COPY]?.title}</b></div>
          <div className="topbar-actions">
            <button className="topbar-help" onClick={() => setView("guide")}><span>?</span>帮助</button>
          </div>
        </header>

        <div className="page-content">
          {view === "home" ? (
            <div className="home-page">
              <section className="home-hero">
                <div>
                  <p className="eyebrow">DOCBOX · 纸间文档盒</p>
                  <h1>文档转换，就这么简单。</h1>
                  <p>转换、识别、整理，一看就会。选择任务，添加文件，然后开始。</p>
                  <div className="hero-actions"><button className="button primary" onClick={() => setView("convert")}>浏览全部工具</button><button className="button ghost" onClick={() => setView("guide")}>查看使用教程</button></div>
                </div>
                <div className="hero-status">
                  <span>工作台概览</span><b>所有工具都在这里</b>
                  <dl><div><dt>{TOOLS.length}</dt><dd>个工具入口</dd></div><div><dt>{jobs.length}</dt><dd>个队列任务</dd></div><div><dt>{completedCount}</dt><dd>个已完成</dd></div></dl>
                  <button className="button primary hero-quick-start" onClick={quickStart}>＋ 添加文件并开始</button>
                </div>
              </section>

              <HomeToolBoard libreOfficeReady={Boolean(libreOfficePath)} onSelect={selectTool} onDownload={() => openUrl("https://www.libreoffice.org/download/download-libreoffice/")} />
            </div>
          ) : null}

          {(["convert", "export", "ocr", "pdf"] as ViewId[]).includes(view) ? (
            <div className="tools-page">
              <section className={`page-intro intro-${view}`}>
                <p className="eyebrow">工具分类</p>
                <h1>{GROUP_COPY[view as keyof typeof GROUP_COPY].title}</h1>
                <p>{GROUP_COPY[view as keyof typeof GROUP_COPY].subtitle}</p>
              </section>
              <div className="section-heading"><div><h2>选择一个工具</h2><p>进入后添加文件、确认设置，再选择保存位置并开始。</p></div><span>{TOOLS.filter((tool) => tool.group === view).length} 个可用工具</span></div>
              <ToolGrid tools={TOOLS.filter((tool) => tool.group === view)} onSelect={selectTool} />
            </div>
          ) : null}

          {view === "workspace" ? (
            <div className="workspace-page">
              <button className="back-link" onClick={() => setView("home")}>← 返回首页</button>
              <section className="workspace-title">
                <span className={`tool-icon large tone-${activeTool.group}`}>{activeTool.icon}</span>
                <div><p className="eyebrow">{GROUP_COPY[activeTool.group].title}</p><h1>{activeTool.title}</h1><p>{activeTool.description}</p><span className="format-pill">支持：{activeTool.accepts}</span></div>
              </section>
              <ol className="flow-steps clear-flow">
                <li className="done"><i>✓</i><span><b>选择功能</b><small>{activeTool.title}</small></span></li>
                <li className={activeToolJobs.length > 0 ? "done" : "current"}><i>{activeToolJobs.length > 0 ? "✓" : "2"}</i><span><b>添加文件</b><small>{activeToolJobs.length > 0 ? `已添加 ${activeToolJobs.length} 个` : "拖入或点击选择"}</small></span></li>
                <li className={running || activeInputJobs.some((job) => job.status === "completed") ? "done" : activeToolJobs.length > 0 ? "current" : ""}><i>{running || activeInputJobs.some((job) => job.status === "completed") ? "✓" : "3"}</i><span><b>选择保存位置</b><small>{activeToolId === "batch-pdf" ? "选择输出文件夹" : "在另存为窗口确认"}</small></span></li>
                <li className={running ? "current" : activeInputJobs.some((job) => job.status === "completed") ? "done" : ""}><i>{activeInputJobs.some((job) => job.status === "completed") ? "✓" : "4"}</i><span><b>本地处理</b><small>{running ? `${activeProgress}% 处理中` : activeInputJobs.some((job) => job.status === "completed") ? "处理完成" : "显示进度和结果"}</small></span></li>
              </ol>

              <div className={activeToolId === "stamp-pdf" ? "workspace-grid stamp-workspace" : "workspace-grid"}>
                <section className="panel queue-panel">
                  <div className="panel-heading"><div><h2>待处理文件</h2><p>当前工具共有 {activeToolJobs.length} 个任务 · 点击一项作为当前文件</p></div><div><button className="button ghost small" onClick={chooseFolder}>添加文件夹</button><button className="button primary small" onClick={chooseFiles}>＋ 添加文件</button></div></div>
                  <button className="drop-zone" onClick={chooseFiles}><span>＋</span><div><b>点击选择，或将文件拖到这里</b><small>{activeTool.accepts}</small></div></button>
                  <div className="queue-toolbar"><span>{activeTool.multi ? "文件右侧可调整顺序；输出顺序与队列一致" : "文件右侧可预览、重试或删除"}</span></div>
                  <div className="job-list">
                    {activeToolJobs.length === 0 ? <div className="empty-state"><span>□</span><b>还没有文件</b><p>添加符合格式的文件后，“选择保存位置并开始”按钮会自动可用。</p></div> : activeToolJobs.map((job) => (
                      <article className={`job-row${job.id === selectedId ? " selected" : ""}${toolMatchesPath(activeToolId, job.path) ? "" : " unsupported"}`} key={job.id}>
                        <button className="job-select" onClick={() => setSelectedId(job.id)} aria-label={`选择 ${job.name}`}><span>{isImage(job.path) ? "IMG" : isPdf(job.path) ? "PDF" : extension(job.path).toUpperCase()}</span></button>
                        <button className="job-info" onClick={() => setSelectedId(job.id)}><b title={job.name}>{job.name}</b><small>{job.kind} · {job.detail}</small><span className="job-progress"><i><em style={{ width: `${job.progress}%` }} /></i><strong>{job.progress}%</strong></span></button>
                        <span className={`status status-${job.status}`}>{toolMatchesPath(activeToolId, job.path) ? STATUS_LABEL[job.status] : "格式不符"}</span>
                        <div className="row-actions">
                          <button onClick={() => { setSelectedId(job.id); setPreviewOpen(true); }} title="预览文件">预览</button>
                          {job.status === "failed" || job.status === "cancelled" ? <button onClick={() => retryJob(job.id)} title="重新加入等待队列">重试</button> : null}
                          {activeTool.multi ? <><button onClick={() => moveJob(job.id, -1)} disabled={job.status === "running" || activeToolJobs[0]?.id === job.id} title="向上移动">↑</button><button onClick={() => moveJob(job.id, 1)} disabled={job.status === "running" || activeToolJobs[activeToolJobs.length - 1]?.id === job.id} title="向下移动">↓</button></> : null}
                          <button className="delete" onClick={() => removeJob(job.id)} disabled={job.status === "running"} title="从队列删除">删除</button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <aside className="panel settings-panel">
                  <div className="panel-heading"><div><h2>转换设置</h2><p>只显示当前工具需要的选项</p></div></div>
                  {activeToolId === "batch-pdf" ? <>
                    <label className="field"><span>输出文件夹</span><div className="field-with-button"><input value={outputFolder} readOnly placeholder="请选择保存位置" /><button onClick={selectOutputFolder}>选择</button></div></label>
                    <label className="field"><span>文件命名规则</span><input value={namingRule} onChange={(event) => setNamingRule(event.currentTarget.value)} placeholder="{name}_{index}" /><small>可用变量：&#123;name&#125;、&#123;index&#125;</small></label>
                    <label className="field"><span>同名文件处理</span><select value={conflictPolicy} onChange={(event) => setConflictPolicy(event.currentTarget.value as "rename" | "overwrite" | "skip")}><option value="rename">自动重命名</option><option value="overwrite">覆盖原文件</option><option value="skip">跳过该文件</option></select></label>
                  </> : null}
                  {activeToolId === "split-pdf" ? <label className="field"><span>每个文件包含页数</span><input type="number" min="1" value={pagesPerFile} onChange={(event) => setPagesPerFile(Math.max(1, Number(event.currentTarget.value) || 1))} /><small>填 1 表示逐页拆分，结果打包为 ZIP。</small></label> : null}
                  {needsDpi ? <label className="field"><span>导出清晰度（DPI）</span><input type="number" min={activeToolId === "pdf-ppt" ? 96 : 72} max="600" value={imageDpi} onChange={(event) => setImageDpi(Math.min(600, Math.max(activeToolId === "pdf-ppt" ? 96 : 72, Number(event.currentTarget.value) || 150)))} /><small>推荐 150；数值越高，文件越大。</small></label> : null}
                  {needsOcr ? <label className="field"><span>低置信度阈值 <em className="plain-note">识别把握不足的提醒线</em></span><div className="range-row"><input type="range" min="50" max="99" value={ocrConfidence} onChange={(event) => setOcrConfidence(Number(event.currentTarget.value))} /><b>{ocrConfidence}%</b></div><small>文字识别的把握低于这个数时，结果会标记为“请人工核对”，不会删除文字。推荐保持 80%；图片模糊时可调到 65%–75%。</small></label> : null}
                  {activeToolId === "organize-pdf" ? <><label className="field"><span>页码范围与顺序</span><input value={pageSpec} onChange={(event) => setPageSpec(event.currentTarget.value)} placeholder="例如：3,1,2,5-8" /><small>省略页码即可删除该页；留空表示全部。</small></label><label className="field"><span>统一旋转</span><select value={rotation} onChange={(event) => setRotation(Number(event.currentTarget.value))}><option value={0}>不旋转</option><option value={90}>顺时针 90°</option><option value={180}>旋转 180°</option><option value={270}>顺时针 270°</option></select></label></> : null}
                  {activeToolId === "stamp-pdf" ? <>
                    <label className="field watermark-text-field"><span>水印文字</span><input value={watermark} onChange={(event) => setWatermark(event.currentTarget.value)} placeholder="例如：内部资料 / FNT" /></label>
                    <section className="watermark-presets"><span>快速样式</span><div><button onClick={() => applyWatermarkPreset("center")}>居中淡印</button><button onClick={() => applyWatermarkPreset("corners")}>四处标记</button><button className="recommended" onClick={() => applyWatermarkPreset("fill")}>斜向铺满页面</button></div></section>
                    <div className="watermark-options">
                      <label className="field"><span>排列方式</span><select value={watermarkLayout} onChange={(event) => setWatermarkLayout(event.currentTarget.value as "single" | "grid")}><option value="single">单个水印</option><option value="grid">多个水印</option></select></label>
                      {watermarkLayout === "single" ? <label className="field"><span>水印位置</span><select value={watermarkPosition} onChange={(event) => setWatermarkPosition(event.currentTarget.value as WatermarkPosition)}><option value="top-left">左上</option><option value="top-center">顶部居中</option><option value="top-right">右上</option><option value="center-left">左侧居中</option><option value="center">页面中央</option><option value="center-right">右侧居中</option><option value="bottom-left">左下</option><option value="bottom-center">底部居中</option><option value="bottom-right">右下</option></select></label> : <label className="field"><span>水印数量</span><input type="number" min="2" max="36" value={watermarkCount} onChange={(event) => setWatermarkCount(Math.min(36, Math.max(2, Number(event.currentTarget.value) || 2)))} /><small>自动均匀排列，建议 6–16 个。</small></label>}
                    </div>
                    <label className="field compact-range"><span>文字大小 <b>{watermarkSize} pt</b></span><input type="range" min="14" max="96" value={watermarkSize} onChange={(event) => setWatermarkSize(Number(event.currentTarget.value))} /></label>
                    <label className="field compact-range"><span>透明度 <b>{watermarkOpacity}%</b></span><input type="range" min="5" max="70" value={watermarkOpacity} onChange={(event) => setWatermarkOpacity(Number(event.currentTarget.value))} /><small>数值越低越淡，推荐 12%–25%。</small></label>
                    <label className="field compact-range"><span>旋转角度 <b>{watermarkAngle}°</b></span><input type="range" min="-90" max="90" step="5" value={watermarkAngle} onChange={(event) => setWatermarkAngle(Number(event.currentTarget.value))} /></label>
                    <section className="watermark-preview-card">
                      <header><b>效果预览</b><span>示意效果，实际尺寸会按 PDF 页面适配</span></header>
                      <div className="watermark-page"><div className="mock-document-lines"><i /><i /><i /><i /><i /></div><div className={watermarkLayout === "grid" ? "watermark-layer grid" : `watermark-layer single pos-${watermarkPosition}`} style={{ opacity: watermarkOpacity / 100, ...(watermarkLayout === "grid" ? { gridTemplateColumns: `repeat(${Math.max(1, Math.ceil(Math.sqrt(watermarkCount * 0.72)))}, minmax(0, 1fr))` } : {}) }}>{Array.from({ length: watermarkLayout === "grid" ? Math.min(watermarkCount, 36) : 1 }, (_, index) => <span key={index} style={{ fontSize: `${Math.max(10, watermarkSize * 0.42)}px`, transform: `rotate(${watermarkAngle}deg)` }}>{watermark || "水印预览"}</span>)}</div>{pageNumbers ? <small className="preview-page-number">第 1 / 8 页</small> : null}</div>
                    </section>
                    <label className="field watermark-image-field"><span>图片 / 图案水印</span><div className="field-with-button"><input value={watermarkImage} readOnly placeholder="可选择 Logo、印章或自定义图案" /><button onClick={selectWatermarkImage}>选择图片</button></div><small>支持 PNG、JPG、WebP、BMP、TIFF；图片水印会以半透明斜向图案铺满页面。</small>{watermarkImage ? <button className="inline-clear" onClick={() => setWatermarkImage("")}>清除图片水印</button> : null}</label>
                    <label className="check-field watermark-page-field"><input type="checkbox" checked={pageNumbers} onChange={(event) => setPageNumbers(event.currentTarget.checked)} /><span><b>添加连续页码</b><small>页码显示在页面底部中央</small></span></label>
                  </> : null}
                  {needsPassword ? <label className="field"><span>{activeToolId === "decrypt-pdf" ? "原 PDF 密码" : "设置 PDF 密码"}</span><input type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="请输入密码" /></label> : null}
                  {needsLibreOffice ? <section className={libreOfficePath ? "setting-note success" : "setting-note warning"}><b>{libreOfficePath ? "Office 引擎已就绪" : "Office 文件需要 LibreOffice"}</b><p>{libreOfficePath ? "DOCX、PPTX、XLSX、CSV 和 HTML 可以转换。" : "图片、TXT、Markdown 不受影响；Office 文件转换前请先安装。"}</p>{libreOfficePath === null ? <button onClick={() => openUrl("https://www.libreoffice.org/download/download-libreoffice/")}>安装 LibreOffice →</button> : null}</section> : null}
                  {!needsDpi && !needsOcr && !needsPassword && activeToolId !== "batch-pdf" && activeToolId !== "split-pdf" && activeToolId !== "organize-pdf" && activeToolId !== "stamp-pdf" && !needsLibreOffice ? <section className="setting-note neutral"><b>无需额外设置</b><p>确认左侧文件和顺序后，在底部选择保存位置并开始。</p></section> : null}
                  <section className="selected-file"><span>当前文件</span><b>{selectedJob?.name ?? "尚未选择"}</b><small>{selectedJob?.path ?? "请在左侧队列中选择一个文件"}</small></section>
                </aside>
              </div>

              <footer className="run-dock">
                <div className="run-status"><div className="next-step-copy"><span>下一步</span><b>{activeFailures > 0 && !running ? `${activeFailures} 个文件处理失败，可检查原因后重试` : nextStepTitle}</b><p>{nextStepDetail}</p></div>{running || activeProgress > 0 ? <div className="overall-progress"><i><em style={{ width: `${activeProgress}%` }} /></i><strong>{activeProgress}%</strong></div> : null}</div>
                <div className="run-actions">
                  {activeToolId === "batch-pdf" && (batchStatus === "running" || batchStatus === "paused") ? <><button className="button ghost" onClick={togglePause}>{batchStatus === "paused" ? "继续" : "暂停"}</button><button className="button danger" onClick={cancelBatch}>取消</button></> : null}
                  {activeToolJobs.length === 0 ? <button className="button ghost add-from-dock" onClick={chooseFiles}>＋ 添加文件</button> : null}
                  <button className="button run-button" onClick={runActiveTool} disabled={runDisabled}><span>{running ? "◌" : "→"}</span>{running ? `正在处理 ${activeProgress}%` : saveActionLabel}</button>
                </div>
              </footer>
            </div>
          ) : null}

          {view === "batch" ? (
            <div className="batch-page">
              <section className="page-intro batch-intro">
                <p className="eyebrow">任务中心</p>
                <h1>全部任务</h1>
                <p>转换、文字识别和 PDF 工具产生的任务，都集中在这里。</p>
              </section>

              <section className="batch-summary" aria-label="任务概览">
                <article><span>全部任务</span><b>{jobs.length}</b></article>
                <article><span>等待处理</span><b>{waitingCount}</b></article>
                <article className="processing"><span>正在处理</span><b>{processingCount}</b></article>
                <article className="success"><span>处理完成</span><b>{completedCount}</b></article>
                <article className={failedCount > 0 ? "danger" : ""}><span>处理失败</span><b>{failedCount}</b></article>
              </section>

              <section className="batch-center">
                <header>
                  <div><h2>任务队列</h2><p>{jobs.length === 0 ? "还没有任务。先选择要处理的功能。" : `当前共 ${jobs.length} 个任务，整体进度 ${queueProgress}%。`}</p></div>
                  <div className="batch-actions">
                    <button className="button primary small" onClick={quickStart}>＋ 新建任务</button>
                    <button className="button ghost small" disabled={failedCount === 0} onClick={() => jobs.filter((job) => job.status === "failed" || job.status === "cancelled").forEach((job) => retryJob(job.id))}>重试失败任务</button>
                    <button className="button ghost small" disabled={completedCount === 0} onClick={() => setJobs((current) => current.filter((job) => job.status !== "completed"))}>清除已完成</button>
                  </div>
                </header>

                {jobs.length === 0 ? (
                  <div className="batch-empty"><span>≡</span><h2>还没有任务</h2><p>点击“新建任务”，选择转换、OCR 或 PDF 工具，再添加文件。</p><button className="button primary" onClick={quickStart}>选择功能</button></div>
                ) : (
                  <div className="global-task-list">
                    {jobs.map((job) => {
                      const tool = job.toolId ? TOOLS.find((item) => item.id === job.toolId) : undefined;
                      return (
                        <article className={`global-task-row status-${job.status}`} key={job.id}>
                          <button className="global-task-type" onClick={() => openQueuedJob(job)} aria-label={`查看 ${job.name}`}>{isImage(job.path) ? "IMG" : isPdf(job.path) ? "PDF" : extension(job.path).toUpperCase()}</button>
                          <div className="global-task-info">
                            <div><b title={job.name}>{job.name}</b><span>{tool?.title ?? job.kind}</span></div>
                            <small title={job.path}>{job.path}</small>
                            <p className={job.status === "failed" ? "error-text" : ""}>{job.detail}</p>
                            {job.output ? <p className="global-output" title={job.output}>结果：{job.output}</p> : null}
                          </div>
                          <div className="global-task-state">
                            <b>{jobStatusText(job)}</b>
                            <div><i style={{ width: `${job.progress}%` }} /></div>
                            <small>{job.progress}%</small>
                          </div>
                          <div className="global-task-actions">
                            <button onClick={() => openQueuedJob(job)}>{job.status === "waiting" || job.status === "paused" ? "继续任务" : "查看任务"}</button>
                            <button onClick={() => { setSelectedId(job.id); setPreviewOpen(true); }}>预览</button>
                            {job.status === "failed" || job.status === "cancelled" ? <button onClick={() => retryJob(job.id)}>重试</button> : null}
                            {job.output ? <button onClick={() => openPath(job.output!)}>打开结果</button> : null}
                            <button className="delete" disabled={job.status === "running"} onClick={() => removeJob(job.id)}>删除</button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {view === "history" ? (
            <div className="history-page">
              <section className="page-intro"><p className="eyebrow">任务管理</p><h1>转换历史</h1><p>仅保存在这台电脑，最多保留 500 条记录。</p></section>
              <div className="history-actions"><span>共 {history.length} 条</span><div>{outputFolder ? <button className="button ghost" onClick={() => openPath(outputFolder)}>打开输出文件夹</button> : null}<button className="button ghost" disabled={history.length === 0} onClick={() => setHistory([])}>清空历史</button></div></div>
              <section className="history-list">
                {history.length === 0 ? <div className="empty-state tall"><span>↻</span><b>暂无转换记录</b><p>完成转换后，结果路径与失败原因会显示在这里。</p></div> : history.map((entry) => <article key={entry.id}><span className={entry.error ? "history-mark error" : "history-mark"}>{entry.error ? "!" : "✓"}</span><div><b>{fileName(entry.source)}</b><small>{new Date(entry.time).toLocaleString()} · {entry.source}</small><p className={entry.error ? "error-text" : "result-text"}>{entry.error ?? entry.output}</p></div>{entry.output ? <button className="button ghost small" onClick={() => openPath(entry.output!)}>打开结果</button> : null}</article>)}
              </section>
            </div>
          ) : null}

          {view === "guide" ? <GuideContent onPickTool={selectTool} /> : null}
          {view === "settings" ? <SettingsContent outputFolder={outputFolder} libreOfficeOverride={libreOfficeOverride} libreOfficeDetected={libreOfficePath} tempDirectory={tempDirectory} namingRule={namingRule} conflictPolicy={conflictPolicy} ocrConfidence={ocrConfidence} imageDpi={imageDpi} autoOpenResult={autoOpenResult} historyCount={history.length} onChooseOutputFolder={selectOutputFolder} onChooseLibreOffice={selectLibreOfficePath} onClearLibreOffice={() => setLibreOfficeOverride("")} onChooseTempDirectory={selectTempDirectory} onClearTempDirectory={() => setTempDirectory("")} onNamingRuleChange={setNamingRule} onConflictPolicyChange={setConflictPolicy} onOcrConfidenceChange={setOcrConfidence} onImageDpiChange={setImageDpi} onAutoOpenResultChange={setAutoOpenResult} onDownloadLibreOffice={() => openUrl("https://www.libreoffice.org/download/download-libreoffice/")} onShowWelcome={() => { localStorage.removeItem(GUIDE_KEY); setShowWelcome(true); }} onClearHistory={() => setHistory([])} /> : null}
          {view === "about" ? <AboutContent onOpenWebsite={() => openUrl("https://www.fornowtoday.com")} onContact={() => openUrl(`mailto:${BRAND.email}`)} /> : null}
        </div>
      </main>

      {previewOpen ? <div className="drawer-layer" onMouseDown={(event) => { if (event.currentTarget === event.target) setPreviewOpen(false); }}><aside className="preview-drawer" aria-label="文件预览"><header><div><span>结果预览</span><b>{selectedJob?.name ?? "未选择文件"}</b></div><button className="icon-button" onClick={() => setPreviewOpen(false)} aria-label="关闭预览">×</button></header><FilePreview path={selectedJob?.output ?? selectedJob?.path} /><section className="preview-meta"><span>状态</span><b>{selectedJob ? STATUS_LABEL[selectedJob.status] : "无"}</b><p>{selectedJob?.detail}</p><small>{selectedJob?.output ?? selectedJob?.path}</small></section><footer>{selectedJob?.output ? <button className="button primary" onClick={() => openPath(selectedJob.output!)}>打开结果</button> : null}{outputFolder ? <button className="button ghost" onClick={() => openPath(outputFolder)}>打开文件夹</button> : null}</footer></aside></div> : null}
      {showQuickPicker ? <QuickStartPicker libreOfficeReady={Boolean(libreOfficePath)} onClose={() => setShowQuickPicker(false)} onSelect={(id) => { setShowQuickPicker(false); selectTool(id); }} onDownload={() => openUrl("https://www.libreoffice.org/download/download-libreoffice/")} /> : null}
      {toast ? <aside className={`result-toast ${toast.kind}`} role="status" aria-live="polite"><span className="toast-mark">{toast.kind === "success" ? "✓" : "!"}</span><div><b>{toast.title}</b><p>{toast.detail}</p><small title={toast.path}>{toast.path}</small><div className="toast-actions"><button onClick={() => IS_TAURI ? invoke("reveal_path", { path: toast.path }) : undefined}>打开所在位置</button>{toast.kind === "success" ? <button onClick={() => openPath(toast.path)}>打开结果</button> : null}</div></div><button className="toast-close" onClick={() => setToast(null)} aria-label="关闭提示">×</button></aside> : null}
      {showWelcome ? <WelcomeGuide onClose={() => closeWelcome()} onNeverShow={neverShowWelcome} onGuide={() => closeWelcome("guide")} /> : null}
    </div>
  );
}
