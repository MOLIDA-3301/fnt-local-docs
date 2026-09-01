// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::io::Write;
use std::process::{Command, Stdio};

#[tauri::command]
fn merge_images_to_pdf(sources: Vec<String>, destination: String) -> Result<String, String> {
    if sources.is_empty() { return Err("至少选择一张图片".into()); }
    let script = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts/images_to_pdf.py");
    let request = serde_json::json!({ "sources": sources, "destination": destination });
    let mut child = Command::new("python")
        .arg(script).stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::piped())
        .spawn().map_err(|_| "未找到 Python：请重新打开软件后再试".to_string())?;
    child.stdin.as_mut().ok_or("无法启动本地转换进程")?
        .write_all(request.to_string().as_bytes()).map_err(|error| error.to_string())?;
    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    if output.status.success() { Ok(destination) } else { Err(String::from_utf8_lossy(&output.stderr).trim().to_string()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![merge_images_to_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
