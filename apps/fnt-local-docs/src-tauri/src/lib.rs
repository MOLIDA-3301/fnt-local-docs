// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_shell::ShellExt;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const SUPPORTED_EXTENSIONS: &[&str] = &["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "txt", "md", "markdown", "html", "htm", "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff", "mp3", "wav", "m4a", "ogg", "mp4", "webm", "mov", "mkv"];

#[derive(Serialize)]
struct LocalFile {
    path: String,
    size: u64,
}

fn collect_supported_files(directory: &Path, files: &mut Vec<LocalFile>) -> Result<(), String> {
    for entry in fs::read_dir(directory).map_err(|error| format!("无法读取文件夹：{error}"))? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            collect_supported_files(&path, files)?;
        } else if path.extension().and_then(|value| value.to_str()).map(|value| SUPPORTED_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str())).unwrap_or(false) {
            let size = entry.metadata().map_err(|error| error.to_string())?.len();
            files.push(LocalFile { path: path.to_string_lossy().to_string(), size });
        }
    }
    Ok(())
}

#[tauri::command]
fn list_supported_files(directory: String) -> Result<Vec<LocalFile>, String> {
    let path = PathBuf::from(directory);
    if !path.is_dir() { return Err("选择的路径不是文件夹".into()); }
    let mut files = Vec::new();
    collect_supported_files(&path, &mut files)?;
    files.sort_by(|left, right| left.path.to_lowercase().cmp(&right.path.to_lowercase()));
    Ok(files)
}

#[tauri::command]
fn expand_dropped_paths(paths: Vec<String>) -> Result<Vec<LocalFile>, String> {
    let mut files = Vec::new();
    for value in paths {
        let path = PathBuf::from(value);
        if path.is_dir() {
            collect_supported_files(&path, &mut files)?;
        } else if path.is_file() && path.extension().and_then(|extension| extension.to_str()).map(|extension| SUPPORTED_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())).unwrap_or(false) {
            files.push(LocalFile { path: path.to_string_lossy().to_string(), size: path.metadata().map_err(|error| error.to_string())?.len() });
        }
    }
    files.sort_by(|left, right| left.path.to_lowercase().cmp(&right.path.to_lowercase()));
    Ok(files)
}

#[tauri::command]
fn validate_batch_inputs(sources: Vec<String>) -> Result<u64, String> {
    let mut total = 0_u64;
    for source in sources {
        let metadata = fs::metadata(&source).map_err(|error| format!("无法读取 {source}：{error}"))?;
        total = total.checked_add(metadata.len()).ok_or("批量大小计算溢出")?;
        if total > 2 * 1024 * 1024 * 1024 { return Err("一次批量任务的总输入不能超过 2GB".into()); }
    }
    Ok(total)
}

#[tauri::command]
fn resolve_output_path(directory: String, file_name: String, conflict: String) -> Result<String, String> {
    let directory = PathBuf::from(directory);
    if !directory.is_dir() { return Err("输出文件夹不存在".into()); }
    let sanitized: String = file_name.chars().map(|character| if "<>:\"/\\|?*".contains(character) { '_' } else { character }).collect();
    let requested = directory.join(sanitized);
    if !requested.exists() || conflict == "overwrite" { return Ok(requested.to_string_lossy().to_string()); }
    if conflict == "skip" { return Err("SKIP_EXISTS".into()); }
    let stem = requested.file_stem().and_then(|value| value.to_str()).unwrap_or("output");
    let extension = requested.extension().and_then(|value| value.to_str()).unwrap_or("");
    for index in 1..10_000 {
        let candidate_name = if extension.is_empty() { format!("{stem} ({index})") } else { format!("{stem} ({index}).{extension}") };
        let candidate = directory.join(candidate_name);
        if !candidate.exists() { return Ok(candidate.to_string_lossy().to_string()); }
    }
    Err("无法生成不冲突的输出文件名".into())
}

#[tauri::command]
fn read_preview_text(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    let allowed = ["txt", "md", "markdown", "csv", "html", "htm", "json", "log"];
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if !allowed.contains(&extension.as_str()) { return Err("该格式不支持文本预览".into()); }
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > 5 * 1024 * 1024 { return Err("文本超过 5MB，请使用外部编辑器打开".into()); }
    let bytes = fs::read(path).map_err(|error| format!("无法读取文本：{error}"))?;
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
async fn merge_images_to_pdf(app: tauri::AppHandle, sources: Vec<String>, destination: String) -> Result<String, String> {
    if sources.is_empty() { return Err("至少选择一张图片".into()); }
    let mut args = vec!["images-to-pdf".to_string(), "--destination".to_string(), destination.clone()];
    for source in sources { args.push("--source".to_string()); args.push(source); }
    let output = app.shell().sidecar("fnt-converter")
        .map_err(|error| format!("无法启动内置转换器：{error}"))?
        .args(args).output().await.map_err(|error| error.to_string())?;
    if output.status.success() { Ok(destination) } else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

#[tauri::command]
async fn images_to_scan_pdf(app: tauri::AppHandle, sources: Vec<String>, destination: String) -> Result<String, String> {
    if sources.is_empty() { return Err("至少选择一张图片".into()); }
    let mut args = vec!["images-to-scan-pdf".to_string(), "--destination".to_string(), destination.clone()];
    for source in sources { args.push("--source".to_string()); args.push(source); }
    run_converter(&app, args, destination).await
}

async fn run_converter(app: &tauri::AppHandle, args: Vec<String>, destination: String) -> Result<String, String> {
    let output = app.shell().sidecar("fnt-converter").map_err(|error| error.to_string())?
        .args(args).output().await.map_err(|error| error.to_string())?;
    if output.status.success() { Ok(destination) } else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

async fn converter_output(app: &tauri::AppHandle, args: Vec<String>) -> Result<String, String> {
    let output = app.shell().sidecar("fnt-converter").map_err(|error| error.to_string())?
        .args(args).output().await.map_err(|error| error.to_string())?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
async fn merge_pdfs(app: tauri::AppHandle, sources: Vec<String>, destination: String) -> Result<String, String> {
    let mut args = vec!["merge-pdf".into(), "--destination".into(), destination.clone()];
    for source in sources { args.push("--source".into()); args.push(source); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn split_pdf(app: tauri::AppHandle, source: String, destination: String, every: u32, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["split-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--every".into(), every.to_string()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn encrypt_pdf(app: tauri::AppHandle, source: String, destination: String, password: String) -> Result<String, String> {
    let args = vec!["encrypt-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--password".into(), password];
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn decrypt_pdf(app: tauri::AppHandle, source: String, destination: String, password: String) -> Result<String, String> {
    let args = vec!["decrypt-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--password".into(), password];
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn organize_pdf(app: tauri::AppHandle, source: String, destination: String, pages: Option<String>, rotate: u32, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["organize-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--rotate".into(), rotate.to_string()];
    if let Some(pages) = pages { if !pages.trim().is_empty() { args.push("--pages".into()); args.push(pages); } }
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn compress_pdf(app: tauri::AppHandle, source: String, destination: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["compress-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn stamp_pdf(app: tauri::AppHandle, source: String, destination: String, watermark: Option<String>, page_numbers: bool, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["stamp-pdf".into(), "--source".into(), source, "--destination".into(), destination.clone()];
    if let Some(watermark) = watermark { if !watermark.trim().is_empty() { args.push("--watermark".into()); args.push(watermark); } }
    if page_numbers { args.push("--page-numbers".into()); }
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn pdf_to_text(app: tauri::AppHandle, source: String, destination: String, format: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["pdf-to-text".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--format".into(), format];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn files_to_pdf(app: tauri::AppHandle, sources: Vec<String>, destination: String) -> Result<String, String> {
    if sources.is_empty() { return Err("至少选择一个文件".into()); }
    let mut args = vec!["files-to-pdf".into(), "--destination".into(), destination.clone()];
    for source in sources { args.push("--source".into()); args.push(source); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn conversion_engine_status(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let output = converter_output(&app, vec!["engine-status".into()]).await?;
    serde_json::from_str(&output).map_err(|error| format!("无法读取转换引擎状态：{error}"))
}

#[tauri::command]
async fn pdf_to_images(app: tauri::AppHandle, source: String, destination: String, dpi: u32, format: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["pdf-to-images".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--dpi".into(), dpi.to_string(), "--format".into(), format];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn pdf_to_word(app: tauri::AppHandle, source: String, destination: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["pdf-to-word".into(), "--source".into(), source, "--destination".into(), destination.clone()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn ocr_document(app: tauri::AppHandle, source: String, destination: String, format: String, password: Option<String>, min_confidence: f64) -> Result<String, String> {
    let mut args = vec!["ocr-document".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--format".into(), format, "--min-confidence".into(), min_confidence.to_string()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn pdf_to_excel(app: tauri::AppHandle, source: String, destination: String, password: Option<String>, min_confidence: f64) -> Result<String, String> {
    let mut args = vec!["pdf-to-excel".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--min-confidence".into(), min_confidence.to_string()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[tauri::command]
async fn pdf_to_ppt(app: tauri::AppHandle, source: String, destination: String, password: Option<String>, dpi: u32) -> Result<String, String> {
    let mut args = vec!["pdf-to-ppt".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--dpi".into(), dpi.to_string()];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_supported_files, expand_dropped_paths, validate_batch_inputs, resolve_output_path, read_preview_text, merge_images_to_pdf, images_to_scan_pdf, merge_pdfs, split_pdf, encrypt_pdf, decrypt_pdf, organize_pdf, compress_pdf, stamp_pdf, pdf_to_text, files_to_pdf, conversion_engine_status, pdf_to_images, pdf_to_word, ocr_document, pdf_to_excel, pdf_to_ppt])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
