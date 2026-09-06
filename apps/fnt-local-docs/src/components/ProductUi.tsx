import type { ToolDefinition, ToolId } from "../product";
import { GROUP_COPY, TOOLS } from "../product";
import { BRAND } from "../brand";

const GROUP_ICONS = {
  convert: "/category-icons/convert-to-pdf.png",
  export: "/category-icons/export-from-pdf.png",
  ocr: "/category-icons/ocr.png",
  pdf: "/category-icons/pdf-tools.png",
} as const;

const LIBRE_OFFICE_TOOLS = new Set<ToolId>(["word-pdf", "ppt-pdf", "sheet-pdf", "html-pdf"]);

export function FntMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "fnt-mark compact" : "fnt-mark"} aria-label={BRAND.fullName}>
      <img className="brand-glyph" src="/docbox-mark.png" alt="" />
      {compact ? null : <div><b>{BRAND.name}</b><small>{BRAND.chineseName}</small></div>}
    </div>
  );
}

export function ToolGrid({ tools, onSelect }: { tools: ToolDefinition[]; onSelect: (id: ToolId) => void }) {
  return (
    <div className="tool-grid">
      {tools.map((tool) => (
        <button className="tool-card" key={tool.id} onClick={() => onSelect(tool.id)}>
          <span className={`tool-icon tone-${tool.group}`}>{tool.icon}</span>
          <span className="tool-copy">
            <span className="tool-title">{tool.title}{tool.badge ? <em>{tool.badge}</em> : null}</span>
            <span className="tool-description">{tool.description}</span>
            <span className="tool-formats">{tool.accepts}</span>
          </span>
          <span className="tool-arrow" aria-hidden="true">→</span>
        </button>
      ))}
    </div>
  );
}

export function HomeToolBoard({ libreOfficeReady, onSelect, onDownload }: { libreOfficeReady: boolean; onSelect: (id: ToolId) => void; onDownload: () => void }) {
  const groups = Object.keys(GROUP_COPY) as Array<keyof typeof GROUP_COPY>;
  const availableCount = TOOLS.filter((tool) => libreOfficeReady || !LIBRE_OFFICE_TOOLS.has(tool.id)).length;

  return (
    <section className="home-tool-board">
      <header className="board-heading">
        <div><p className="eyebrow">全部功能</p><h2>选择一个工具，直接开始</h2><p>大部分功能安装后即可使用，置灰项目需要补充办公转换引擎。</p></div>
        <div className={libreOfficeReady ? "engine-summary ready" : "engine-summary warning"}><span>{libreOfficeReady ? "✓" : "!"}</span><div><b>{libreOfficeReady ? "全部工具已就绪" : "4 个功能需要先安装"}</b><small>{libreOfficeReady ? "LibreOffice 已连接" : `${availableCount} 个功能现在可以直接用`}</small></div>{!libreOfficeReady ? <button onClick={onDownload}>下载 LibreOffice</button> : null}</div>
      </header>
      <div className="function-groups">
        {groups.map((group) => {
          const tools = TOOLS.filter((tool) => tool.group === group);
          const available = tools.filter((tool) => libreOfficeReady || !LIBRE_OFFICE_TOOLS.has(tool.id)).length;
          return (
            <article className={`function-group group-${group}`} key={group}>
              <header><img src={GROUP_ICONS[group]} alt="" /><div><span>{available} / {tools.length} 可用</span><h3>{GROUP_COPY[group].title}</h3><p>{GROUP_COPY[group].subtitle}</p></div></header>
              <div className="function-list">
                {tools.map((tool) => {
                  const locked = LIBRE_OFFICE_TOOLS.has(tool.id) && !libreOfficeReady;
                  return <button key={tool.id} className={locked ? "function-item locked" : "function-item"} disabled={locked} onClick={() => onSelect(tool.id)}><span className={`mini-tool-icon tone-${group}`}>{tool.icon}</span><span><b>{tool.title}</b><small>{locked ? "需要 LibreOffice" : "可以直接使用"}</small></span><i>{locked ? "锁" : "→"}</i></button>;
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function QuickStartPicker({ libreOfficeReady, onClose, onSelect, onDownload }: { libreOfficeReady: boolean; onClose: () => void; onSelect: (id: ToolId) => void; onDownload: () => void }) {
  const groups = Object.keys(GROUP_COPY) as Array<keyof typeof GROUP_COPY>;
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="quick-picker-title" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="quick-picker-card">
        <header><div><p className="eyebrow">快速开始</p><h1 id="quick-picker-title">你想处理什么？</h1><p>选择功能后，再添加文件。</p></div><button className="icon-button" onClick={onClose} aria-label="关闭功能选择">×</button></header>
        {!libreOfficeReady ? <aside className="quick-engine-note"><span>!</span><div><b>4 个 Office 转 PDF 功能暂不可用</b><small>安装免费的 LibreOffice 后即可解锁。</small></div><button onClick={onDownload}>下载 LibreOffice</button></aside> : null}
        <div className="quick-picker-groups">
          {groups.map((group) => <section key={group}><h2><span className={`mini-tool-icon tone-${group}`}>{group === "convert" ? "PDF" : group === "export" ? "↗" : group === "ocr" ? "字" : "◇"}</span>{GROUP_COPY[group].title}</h2><div>{TOOLS.filter((tool) => tool.group === group).map((tool) => {
            const locked = LIBRE_OFFICE_TOOLS.has(tool.id) && !libreOfficeReady;
            return <button key={tool.id} className={locked ? "quick-tool locked" : "quick-tool"} disabled={locked} onClick={() => onSelect(tool.id)}><span>{tool.icon}</span><b>{tool.title}</b><small>{locked ? "缺少 LibreOffice" : "选择"}</small><i>{locked ? "锁" : "→"}</i></button>;
          })}</div></section>)}
        </div>
      </section>
    </div>
  );
}

export function WelcomeGuide({ onClose, onNeverShow, onGuide }: { onClose: () => void; onNeverShow: () => void; onGuide: () => void }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-card">
        <FntMark />
        <button className="icon-button modal-close" onClick={onClose} aria-label="关闭新手引导">×</button>
        <p className="eyebrow">欢迎使用</p>
        <h1 id="welcome-title">三步完成本地转换</h1>
        <p className="welcome-lead">选择工具、添加文件、选择保存位置，按页面提示即可完成。</p>
        <div className="welcome-steps">
          <article><i>1</i><b>选择工具</b><span>首页按任务分类展示全部功能</span></article>
          <article><i>2</i><b>添加文件</b><span>支持多选、文件夹与直接拖入</span></article>
          <article><i>3</i><b>保存并处理</b><span>选择保存位置后开始，完成后可预览</span></article>
        </div>
        <div className="welcome-actions">
          <button className="button text-button" onClick={onNeverShow}>不再自动显示</button>
          <span className="welcome-action-spacer" />
          <button className="button ghost" onClick={onGuide}>完整教程</button>
          <button className="button primary" onClick={onClose}>开始使用</button>
        </div>
      </section>
    </div>
  );
}

export function GuideContent({ onPickTool }: { onPickTool: (id: ToolId) => void }) {
  return (
    <div className="guide-page guide-simple">
      <section className="guide-hero-simple">
        <div><p className="eyebrow">DOCBOX 使用教程</p><h1>三步完成处理</h1><p>页面会告诉你下一步。一般只需选择工具、添加文件、确认保存位置。</p></div>
        <ol><li><i>1</i><b>选工具</b><span>确定想得到什么结果</span></li><li><i>2</i><b>加文件</b><span>拖入或选择文件</span></li><li><i>3</i><b>保存并开始</b><span>确认位置，查看进度</span></li></ol>
      </section>
      <section className="guide-engine-simple">
        <article className="ready"><i>✓</i><div><b>安装后直接使用</b><p>OCR、PDF 导出、图片与文本转 PDF，以及全部 PDF 整理工具。</p><small>PDF 与中英文 OCR 引擎已经内置。</small></div></article>
        <article className="extra"><i>＋</i><div><b>4 项功能需要 LibreOffice</b><p>Word、PowerPoint、Excel / CSV、HTML 转 PDF。</p><small>其他功能不受影响。</small></div></article>
      </section>
      <section className="guide-section-heading"><div><p className="eyebrow">常用入口</p><h2>点一下，直接开始</h2></div><span>进入工具后，按页面底部提示操作</span></section>
      <div className="guide-shortcuts">
        <button onClick={() => onPickTool("mixed-pdf")}><i>PDF</i><span><b>转成 PDF</b><small>Office、文本、图片合并</small></span><em>→</em></button>
        <button onClick={() => onPickTool("pdf-word")}><i>W</i><span><b>PDF 转 Word</b><small>电子文档或扫描件</small></span><em>→</em></button>
        <button onClick={() => onPickTool("ocr-searchable")}><i>字</i><span><b>扫描件识别</b><small>生成可搜索 PDF</small></span><em>→</em></button>
        <button onClick={() => onPickTool("organize-pdf")}><i>页</i><span><b>整理 PDF</b><small>排序、旋转、删除页面</small></span><em>→</em></button>
      </div>
      <section className="guide-help-simple">
        <p className="eyebrow">遇到问题</p><h2>先检查这三项</h2>
        <div><article><i>01</i><b>按钮还是灰色</b><p>添加符合当前工具格式的文件，再按底部提示补全密码或水印。</p></article><article><i>02</i><b>Office 转 PDF 不可用</b><p>安装 LibreOffice 后重启 DocBox。只有这 4 项依赖它。</p></article><article><i>03</i><b>扫描 PDF 没有文字</b><p>普通导出只读电子文字，请改用“扫描件识别”。</p></article></div>
      </section>
      <footer className="guide-footnote"><b>大文件也能处理</b><span>单次批量不超过 2GB；长 PDF 与 OCR 会逐页处理，因此需要更多时间。</span></footer>
    </div>
  );
}

type SettingsContentProps = {
  outputFolder: string;
  libreOfficeOverride: string;
  libreOfficeDetected: string | null | undefined;
  tempDirectory: string;
  namingRule: string;
  conflictPolicy: "rename" | "overwrite" | "skip";
  ocrConfidence: number;
  imageDpi: number;
  autoOpenResult: boolean;
  historyCount: number;
  onChooseOutputFolder: () => void;
  onChooseLibreOffice: () => void;
  onClearLibreOffice: () => void;
  onChooseTempDirectory: () => void;
  onClearTempDirectory: () => void;
  onNamingRuleChange: (value: string) => void;
  onConflictPolicyChange: (value: "rename" | "overwrite" | "skip") => void;
  onOcrConfidenceChange: (value: number) => void;
  onImageDpiChange: (value: number) => void;
  onAutoOpenResultChange: (value: boolean) => void;
  onDownloadLibreOffice: () => void;
  onShowWelcome: () => void;
  onClearHistory: () => void;
};

export function SettingsContent(props: SettingsContentProps) {
  const engineLabel = props.libreOfficeDetected === undefined
    ? "正在检测…"
    : props.libreOfficeDetected
      ? "已就绪"
      : "尚未找到";

  return (
    <div className="settings-page">
      <section className="page-intro">
        <p className="eyebrow">软件设置</p>
        <h1>设置</h1>
        <p>把常用选项提前设好。以后转换文件，会自动使用这些设置。</p>
      </section>
      <div className="settings-grid">
        <section className="settings-section">
          <header><span>01</span><div><h2>保存与命名</h2><p>设置批量任务默认保存到哪里，以及同名文件怎么处理。</p></div></header>
          <label className="field"><span>默认输出文件夹</span><div className="field-with-button"><input value={props.outputFolder} readOnly placeholder="每次转换时再选择" /><button onClick={props.onChooseOutputFolder}>选择</button></div><small>留空时，每次运行都会询问保存位置。</small></label>
          <label className="field"><span>批量文件命名</span><input value={props.namingRule} onChange={(event) => props.onNamingRuleChange(event.currentTarget.value)} placeholder="{name}" /><small>可用变量：&#123;name&#125; 是原文件名，&#123;index&#125; 是队列序号。</small></label>
          <label className="field"><span>遇到同名文件</span><select value={props.conflictPolicy} onChange={(event) => props.onConflictPolicyChange(event.currentTarget.value as "rename" | "overwrite" | "skip")}><option value="rename">自动重命名（推荐）</option><option value="overwrite">覆盖已有文件</option><option value="skip">跳过，不生成</option></select></label>
          <label className="check-field"><input type="checkbox" checked={props.autoOpenResult} onChange={(event) => props.onAutoOpenResultChange(event.currentTarget.checked)} /><span><b>转换完成后打开结果位置</b><small>默认开启。关闭后只显示成功提示，不再自动跳转到文件夹。</small></span></label>
        </section>

        <section className="settings-section">
          <header><span>02</span><div><h2>转换资源路径</h2><p>软件会自动寻找资源。只有自动检测失败时，才需要手动设置。</p></div></header>
          <div className="resource-setting"><div><span>LibreOffice 程序</span><b>{engineLabel}</b><small>{props.libreOfficeOverride || props.libreOfficeDetected || "仅 Office、CSV 和 HTML 转 PDF 需要"}</small></div><div>{!props.libreOfficeDetected ? <button className="button primary small" onClick={props.onDownloadLibreOffice}>免费下载</button> : null}<button className="button ghost small" onClick={props.onChooseLibreOffice}>选择 soffice.exe</button>{props.libreOfficeOverride ? <button className="button text-button small" onClick={props.onClearLibreOffice}>恢复自动检测</button> : null}</div></div>
          <div className="resource-setting"><div><span>临时文件夹</span><b>{props.tempDirectory ? "已自定义" : "跟随系统"}</b><small>{props.tempDirectory || "默认使用 Windows 临时目录，通常无需修改"}</small></div><div><button className="button ghost small" onClick={props.onChooseTempDirectory}>选择文件夹</button>{props.tempDirectory ? <button className="button text-button small" onClick={props.onClearTempDirectory}>恢复默认</button> : null}</div></div>
          <div className="built-in-note"><b>已经内置，无需设置</b><p>PDF 处理、OCR 引擎和中英文识别模型随安装包提供。无需安装 Python、Tesseract、FFmpeg 或 AVS3。</p></div>
        </section>

        <section className="settings-section">
          <header><span>03</span><div><h2>默认处理参数</h2><p>这些值会出现在对应工具里，也可以在运行前临时修改。</p></div></header>
          <label className="field"><span>OCR 人工核对提醒线</span><div className="range-row"><input type="range" min="50" max="99" value={props.ocrConfidence} onChange={(event) => props.onOcrConfidenceChange(Number(event.currentTarget.value))} /><b>{props.ocrConfidence}%</b></div><small>识别把握低于这个数时，结果会提醒你检查。推荐 80%。</small></label>
          <label className="field"><span>PDF 导出图片清晰度</span><input type="number" min="96" max="600" value={props.imageDpi} onChange={(event) => props.onImageDpiChange(Math.min(600, Math.max(96, Number(event.currentTarget.value) || 150)))} /><small>推荐 150 DPI；打印可选 300 DPI。数值越高，文件越大。</small></label>
        </section>

        <section className="settings-section">
          <header><span>04</span><div><h2>帮助与本机数据</h2><p>新手教程、队列和历史记录都只保存在这台电脑。</p></div></header>
          <div className="settings-action-row"><div><b>重新显示新手引导</b><small>下次打开软件时，也会再次显示三步引导。</small></div><button className="button ghost" onClick={props.onShowWelcome}>立即查看</button></div>
          <div className="settings-action-row"><div><b>清空转换历史</b><small>当前共有 {props.historyCount} 条。只删除记录，不删除原文件和转换结果。</small></div><button className="button ghost" onClick={props.onClearHistory} disabled={props.historyCount === 0}>清空历史</button></div>
        </section>
      </div>
    </div>
  );
}

export function AboutContent({ onOpenWebsite, onContact }: { onOpenWebsite: () => void; onContact: () => void }) {
  return (
    <div className="about-page">
      <section className="about-hero">
        <FntMark />
        <p className="eyebrow">关于软件</p>
        <h1>{BRAND.fullName}</h1>
        <p>一套专注文档转换、OCR 与 PDF 整理的 Windows 桌面工具。</p>
        <div className="about-meta"><span>版本 {BRAND.version}</span><span>构建标识 {BRAND.buildId}</span><button onClick={onOpenWebsite}>{BRAND.website}</button><button onClick={onContact}>联系我：{BRAND.email}</button></div>
      </section>
      <section className="legal-card">
        <h2>原创与免费声明</h2>
        <p>本软件由 FNT 原创开发并免费提供，仅供学习、交流及个人非商业使用。软件本体不以任何形式向个人用户收费。</p>
        <p><b>权利主体与官方网站：</b>FNT · {BRAND.website}</p>
        <p><b>联系邮箱：</b>{BRAND.email}</p>
        <p>未经 FNT 书面授权，禁止二次打包、换皮发布、冒用 FNT 名义、移除版权或构建标识，以及将免费版本作为付费产品销售。</p>
        <p>商业使用、预装分发、品牌合作及修改后再发布须事先取得 FNT 书面授权。对盗版、侵权和恶意套皮行为，FNT 保留依法追究责任的权利。</p>
      </section>
      <section className="legal-card quiet">
        <h2>第三方组件</h2>
        <p>软件使用的开源组件仍分别遵循其原始许可证。本声明不改变、不限制第三方组件许可证授予的权利。</p>
        <p>{BRAND.copyright}</p>
        <p>官方网站：{BRAND.website}</p>
      </section>
    </div>
  );
}
