import type { ToolDefinition, ToolId } from "../product";
import { BRAND } from "../brand";

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

export function WelcomeGuide({ onClose, onNeverShow, onGuide }: { onClose: () => void; onNeverShow: () => void; onGuide: () => void }) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-card">
        <FntMark />
        <button className="icon-button modal-close" onClick={onClose} aria-label="关闭新手引导">×</button>
        <p className="eyebrow">欢迎使用</p>
        <h1 id="welcome-title">三步完成本地转换</h1>
        <p className="welcome-lead">选择工具、添加文件、点击开始运行，三步即可完成。</p>
        <div className="welcome-steps">
          <article><i>1</i><b>选择工具</b><span>首页按任务分类展示全部功能</span></article>
          <article><i>2</i><b>添加文件</b><span>支持多选、文件夹与直接拖入</span></article>
          <article><i>3</i><b>开始运行</b><span>完成后预览、打开或查看历史</span></article>
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
    <div className="guide-page">
      <section className="guide-hero">
        <p className="eyebrow">使用教程</p>
        <h1>第一次使用，从这里开始</h1>
        <p>先选目标工具，再添加文件，最后点击“开始运行”。页面会显示每个文件的进度、结果和失败原因。</p>
      </section>
      <section className="dependency-guide">
        <div className="dependency-title"><span>运行要求</span><h2>哪些开箱即用，哪些需要安装？</h2><p>安装 DocBox 后，大多数功能无需再下载任何东西。</p></div>
        <article className="dependency-ready"><i>✓</i><div><b>无需额外下载</b><p>OCR 文字识别、PDF 转 Word / Excel / PPT / TXT / Markdown / 图片、图片与文本转 PDF，以及 PDF 合并、拆分、整理、压缩、水印、加密和解密。</p><small>OCR、PDF 引擎和中英文识别模型已经包含在安装包内；不需要另装 Python、Tesseract、FFmpeg 或 AVS3。</small></div></article>
        <article className="dependency-extra"><i>＋</i><div><b>只有这些需要 LibreOffice</b><p>Word / DOCX、PowerPoint / PPTX、Excel / XLSX / CSV、HTML → PDF。</p><small>原因：DocBox 调用 LibreOffice 的办公文档排版引擎，避免自己重复打包一整套 Office 内核。未安装时，上述功能会明确提示，其他工具不受影响。</small></div></article>
        <aside className="system-requirement"><b>系统界面组件</b><p>DocBox 使用 Microsoft WebView2 显示界面。Windows 10 / 11 通常已经自带；只有系统缺失时，安装程序才会联网补装一次。它不是 OCR 模型，也不会上传你的文件。</p></aside>
      </section>
      <section className="guide-steps-large">
        <article><span>01</span><div><h3>选择你要完成的任务</h3><p>不要先纠结文件类型：首页分为“转成 PDF、从 PDF 导出、OCR、PDF 工具”四组，直接点击目标工具。</p></div></article>
        <article><span>02</span><div><h3>添加并检查文件</h3><p>可选择文件、整个文件夹或拖入窗口。合并图片和 PDF 时，用上移、下移确定最终页序。</p></div></article>
        <article><span>03</span><div><h3>设置参数并开始运行</h3><p>参数只在需要时显示。点击页面底部黑色“开始运行”，每个文件会显示状态、结果或失败原因。</p></div></article>
        <article><span>04</span><div><h3>查看和管理结果</h3><p>点击“预览”打开结果抽屉，也可直接打开文件或输出文件夹。所有记录只保存在本机历史中。</p></div></article>
      </section>
      <h2>常见任务快速开始</h2>
      <div className="quick-guides">
        <button onClick={() => onPickTool("mixed-pdf")}><b>Office / 图片转 PDF</b><span>选工具 → 添加文件 → 开始运行</span></button>
        <button onClick={() => onPickTool("pdf-word")}><b>PDF 转 Word</b><span>添加 PDF → 选中文件 → 开始运行</span></button>
        <button onClick={() => onPickTool("ocr-searchable")}><b>扫描件变得可搜索</b><span>添加扫描 PDF 或图片 → 设置置信度 → 开始运行</span></button>
        <button onClick={() => onPickTool("organize-pdf")}><b>整理 PDF 页面</b><span>输入页码顺序和旋转角度 → 开始运行</span></button>
      </div>
      <h2 className="guide-detail-title">分类使用说明</h2>
      <section className="guide-details">
        <details open><summary>转成 PDF：Office、文本、HTML 与图片</summary><div><p>Word、PowerPoint、Excel、CSV 和 HTML 依赖本机 LibreOffice；TXT、Markdown 和图片使用内置引擎。需要把多种格式合成一个 PDF 时选择“文件转 PDF”，页序严格跟随队列。</p><p>图片合并前先在队列中选择文件，再用“上移 / 下移”调整顺序。单独转换多个文件并分别保存时使用“批量转 PDF”。</p></div></details>
        <details><summary>从 PDF 导出：Word、Excel、PPT、图片与文本</summary><div><p>PDF 转 Word 会优先尝试恢复段落、表格、图片和布局；扫描件自动回退 OCR。PDF 转 Excel 会生成识别表格及 Raw 原始数据，请检查低置信度标记。</p><p>PDF 转 PPT 以一页 PDF 对应一页幻灯片，保证视觉一致，但页面元素不能单独编辑。导出图片可调整 DPI，150 适合屏幕查看，300 适合打印。</p></div></details>
        <details><summary>OCR：图片和扫描 PDF 变成可编辑内容</summary><div><p>选择 TXT、Markdown 或 Word 可得到可编辑文字；选择“可搜索 PDF”会保留原页面并加入隐藏文字层。置信度阈值越高，被标记为需要人工检查的内容越多。</p><p>OCR 不限制页数，但长文档会逐页处理，需要更多时间和临时磁盘空间。</p></div></details>
        <details><summary>PDF 整理与安全</summary><div><p>“整理 PDF 页面”用逗号和范围表示输出页序，例如 <code>3,1,2,5-8</code>；不写入的页面相当于删除。拆分可设置每个文件包含 N 页，结果自动打包 ZIP。</p><p>加密使用 AES-256；解密必须填写原密码。水印支持文字、Logo、印章或自定义图片图案，并可同时添加页码。压缩以安全结构优化为主，不承诺明显降低以图片为主的 PDF。</p></div></details>
        <details><summary>批量队列、结果预览与历史</summary><div><p>批量模式可设置输出目录、命名规则和同名冲突方式。暂停或取消会在当前单文件完成后生效，单个文件失败不会中止后续任务。</p><p>完成后点击队列中的“预览”；窄窗口下预览会变为底部面板。转换历史只保存在本机，最多 500 条，可查看结果路径与失败原因。</p></div></details>
        <details><summary>常见问题排查</summary><div><p><b>Office 转换不可用：</b>安装 LibreOffice 后重新启动软件，左下角应显示“已就绪”。</p><p><b>开始运行是灰色：</b>检查当前工具支持的格式，并在队列中选中一个符合要求的文件；加密、解密还需要填写密码。</p><p><b>扫描 PDF 没有文字：</b>普通“PDF 转 TXT”只提取电子文字，请改用 OCR 分类中的工具。</p></div></details>
      </section>
      <section className="guide-note">
        <b>资源保护</b>
        <p>单图不超过 50MP 或 16,384px；图片合并总计不超过 100MP；单次批量输入不超过 2GB。长 PDF 和 OCR 不限制页数，但会按页处理并可能耗时较长。</p>
      </section>
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
