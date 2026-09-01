// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_shell::ShellExt;

#[tauri::command]
async fn merge_images_to_pdf(app: tauri::AppHandle, sources: Vec<String>, destination: String) -> Result<String, String> {
    if sources.is_empty() { return Err("至少选择一张图片".into()); }
    let mut args = vec!["--destination".to_string(), destination.clone()];
    for source in sources { args.push("--source".to_string()); args.push(source); }
    let output = app.shell().sidecar("fnt-converter")
        .map_err(|error| format!("无法启动内置转换器：{error}"))?
        .args(args).output().await.map_err(|error| error.to_string())?;
    if output.status.success() { Ok(destination) } else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![merge_images_to_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
