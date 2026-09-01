// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_shell::ShellExt;

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

async fn run_converter(app: &tauri::AppHandle, args: Vec<String>, destination: String) -> Result<String, String> {
    let output = app.shell().sidecar("fnt-converter").map_err(|error| error.to_string())?
        .args(args).output().await.map_err(|error| error.to_string())?;
    if output.status.success() { Ok(destination) } else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
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
async fn pdf_to_text(app: tauri::AppHandle, source: String, destination: String, format: String, password: Option<String>) -> Result<String, String> {
    let mut args = vec!["pdf-to-text".into(), "--source".into(), source, "--destination".into(), destination.clone(), "--format".into(), format];
    if let Some(password) = password { args.push("--password".into()); args.push(password); }
    run_converter(&app, args, destination).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![merge_images_to_pdf, merge_pdfs, split_pdf, encrypt_pdf, decrypt_pdf, pdf_to_text])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
