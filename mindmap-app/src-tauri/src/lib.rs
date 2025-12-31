use std::fs;
use std::path::Path;

// Save document to file (atomic write using temp file + rename)
#[tauri::command]
fn save_document(path: String, content: String) -> Result<(), String> {
    let temp_path = format!("{}.tmp", path);

    // Write to temp file first
    fs::write(&temp_path, &content).map_err(|e| format!("Failed to write file: {}", e))?;

    // Rename temp file to target (atomic on most file systems)
    fs::rename(&temp_path, &path).map_err(|e| {
        // Clean up temp file if rename fails
        let _ = fs::remove_file(&temp_path);
        format!("Failed to save file: {}", e)
    })?;

    Ok(())
}

// Read document from file
#[tauri::command]
fn read_document(path: String) -> Result<String, String> {
    if !Path::new(&path).exists() {
        return Err("File not found".to_string());
    }

    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_document, read_document])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
