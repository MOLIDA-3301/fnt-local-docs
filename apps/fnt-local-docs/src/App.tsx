import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "./App.css";

type JobStatus = "waiting" | "running" | "completed" | "failed";
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

const STORAGE_KEY = "fnt.queue.v2";
const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);
const STATUS_LABEL: Record<JobStatus, string> = {
  waiting: "等待中",
  running: "处理中",
  completed: "已完成",
  failed: "失败",
};

function loadJobs(): Job[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Job[]) : [];
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

export default function App() {
  const [jobs, setJobs] = useState<Job[]>(loadJobs);
  const [selectedId, setSelectedId] = useState<number | null>(() => loadJobs()[0]?.id ?? null);
  const [pagesPerFile, setPagesPerFile] = useState(1);
  const [password, setPassword] = useState("");
  const selectedJob = jobs.find((job) => job.id === selectedId);
  const imageJobs = useMemo(() => jobs.filter((job) => isImage(job.path)), [jobs]);
  const pdfJobs = useMemo(() => jobs.filter((job) => isPdf(job.path)), [jobs]);
  const completedCount = useMemo(() => jobs.filter((job) => job.status === "completed").length, [jobs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [jobs]);

  async function chooseFiles() {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "支持的文件", extensions: ["pdf", "docx", "pptx", "xlsx", "csv", "txt", "md", "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "mp3", "mp4"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    const now = Date.now();
    const added: Job[] = paths.map((path, index) => ({
      id: now + index,
      name: fileName(path),
      path,
      kind: isImage(path) ? "图片 → PDF" : "等待选择转换方式",
      status: "waiting",
      progress: 0,
      detail: "已加入本地队列",
    }));
    setJobs((current) => [...current, ...added]);
    setSelectedId(added[0].id);
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

  return (
    <main className="app">
      <aside>
        <div className="brand">F <span><b>FNT Local Docs</b><small>本地文档工作台</small></span></div>
        <button className="primary" onClick={chooseFiles}>＋ 添加文件</button>
        <nav><b>转换队列 <i>{jobs.length}</i></b><b>本地历史 <i>{completedCount}</i></b></nav>
        <p className="safe">● 文件仅在此设备处理<br />不会上传至服务器</p>
      </aside>
      <section className="work">
        <header><div><small>工作台 / 转换队列</small><h1>本地转换任务</h1></div><div className="header-actions"><button onClick={mergeQueuedPdfs} disabled={pdfJobs.length === 0}>合并 PDF</button><button onClick={mergeImages} disabled={imageJobs.length === 0}>图片转 PDF</button></div></header>
        <div className="cards"><p>队列任务<strong>{jobs.length}</strong><small>{completedCount} 个已完成</small></p><p>图片 / PDF<strong>{imageJobs.length} / {pdfJobs.length}</strong><small>输出顺序跟随队列</small></p><p>处理模式<strong>离线</strong><small>文件不上传服务器</small></p></div>
        <button className="drop" onClick={chooseFiles}><b>选择文件</b><span>支持图片转 PDF、PDF 合并拆分、安全处理与文字提取</span><em>浏览本机</em></button>
        <div className="queue-heading"><h2>转换队列</h2><div><button onClick={() => moveSelected(-1)} disabled={!selectedJob}>上移</button><button onClick={() => moveSelected(1)} disabled={!selectedJob}>下移</button><button onClick={removeSelected} disabled={!selectedJob}>移除</button></div></div>
        {jobs.length === 0 ? <div className="empty">添加图片后即可生成第一个本地 PDF。</div> : jobs.map((job) => (
          <button className={job.id === selectedId ? "job on" : "job"} key={job.id} onClick={() => setSelectedId(job.id)}>
            <strong>{isImage(job.path) ? "IMG" : "DOC"}</strong><span><b>{job.name}</b><small>{job.kind}</small>{job.progress > 0 && job.progress < 100 ? <i><em style={{ width: `${job.progress}%` }} /></i> : null}</span><label className={job.status}>{STATUS_LABEL[job.status]}<small>{job.detail}</small></label>
          </button>
        ))}
      </section>
      <aside className="preview"><div><small>结果与详情</small><b>{selectedJob?.name ?? "尚未选择文件"}</b></div><article><b>FNT</b><h3>{selectedJob?.kind ?? "本地文档转换"}</h3><p>{selectedJob?.detail ?? "从左侧添加文件开始。"}</p>{selectedJob && isPdf(selectedJob.path) ? <section className="pdf-tools"><label>每组页数<input type="number" min="1" value={pagesPerFile} onChange={(event) => setPagesPerFile(Math.max(1, Number(event.currentTarget.value) || 1))} /></label><label>PDF 密码<input type="password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} placeholder="加密或解密时填写" /></label><div><button onClick={() => exportSelectedText("text")}>导出 TXT</button><button onClick={() => exportSelectedText("markdown")}>导出 Markdown</button><button onClick={() => runSelectedPdfAction("split_pdf")}>拆分 ZIP</button><button onClick={() => runSelectedPdfAction("encrypt_pdf")} disabled={!password}>AES-256 加密</button><button onClick={() => runSelectedPdfAction("decrypt_pdf")} disabled={!password}>密码解密</button></div></section> : null}<hr /><p className="path">{selectedJob?.output ?? selectedJob?.path ?? "预览不会将文件发送到网络。"}</p></article><footer>{selectedJob ? STATUS_LABEL[selectedJob.status] : "空队列"}<button className="primary" onClick={selectedJob && isPdf(selectedJob.path) ? mergeQueuedPdfs : mergeImages} disabled={!selectedJob}>开始处理</button></footer></aside>
    </main>
  );
}
