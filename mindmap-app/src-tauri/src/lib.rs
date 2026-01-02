use std::fs;
use std::path::Path;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};
use tauri::{Emitter, Manager};

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
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![save_document, read_document])
        .setup(|app| {
            // === File menu items ===
            let new_doc = MenuItemBuilder::with_id("new", "New")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open_doc = MenuItemBuilder::with_id("open", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let save_doc = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_doc)
                .item(&open_doc)
                .separator()
                .item(&save_doc)
                .item(&save_as)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            // === Edit menu items ===
            let copy_for_miro = MenuItemBuilder::with_id("copy_for_miro", "Copy for Miro")
                .accelerator("CmdOrCtrl+Shift+M")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&PredefinedMenuItem::undo(app, None)?)
                .item(&PredefinedMenuItem::redo(app, None)?)
                .separator()
                .item(&PredefinedMenuItem::cut(app, None)?)
                .item(&PredefinedMenuItem::copy(app, None)?)
                .item(&PredefinedMenuItem::paste(app, None)?)
                .separator()
                .item(&copy_for_miro)
                .item(&PredefinedMenuItem::select_all(app, None)?)
                .build()?;

            // === View menu items ===
            let mindmap_mode = MenuItemBuilder::with_id("view_mindmap", "Mind Map")
                .accelerator("CmdOrCtrl+1")
                .build(app)?;
            let outline_mode = MenuItemBuilder::with_id("view_outline", "Outline")
                .accelerator("CmdOrCtrl+2")
                .build(app)?;
            let find = MenuItemBuilder::with_id("find", "Find...")
                .accelerator("CmdOrCtrl+F")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&mindmap_mode)
                .item(&outline_mode)
                .separator()
                .item(&find)
                .build()?;

            // === Node menu items ===
            let create_child = MenuItemBuilder::with_id("create_child", "Create Child")
                .accelerator("Tab")
                .build(app)?;
            let create_sibling = MenuItemBuilder::with_id("create_sibling", "Create Sibling")
                .accelerator("Enter")
                .build(app)?;
            let create_sibling_above = MenuItemBuilder::with_id("create_sibling_above", "Create Sibling Above")
                .accelerator("Shift+Enter")
                .build(app)?;
            let edit_node = MenuItemBuilder::with_id("edit_node", "Edit")
                .accelerator("F2")
                .build(app)?;
            let delete_node = MenuItemBuilder::with_id("delete_node", "Delete")
                .accelerator("Backspace")
                .build(app)?;
            let toggle_collapse = MenuItemBuilder::with_id("toggle_collapse", "Expand/Collapse")
                .accelerator("Space")
                .build(app)?;
            let toggle_collapse_all = MenuItemBuilder::with_id("toggle_collapse_all", "Expand/Collapse All")
                .accelerator("Shift+Alt+Space")
                .build(app)?;
            let open_icon_picker = MenuItemBuilder::with_id("open_icon_picker", "Add Icon...")
                .accelerator("I")
                .build(app)?;
            let add_link = MenuItemBuilder::with_id("add_link", "Add Link...")
                .accelerator("CmdOrCtrl+K")
                .build(app)?;

            let node_menu = SubmenuBuilder::new(app, "Node")
                .item(&create_child)
                .item(&create_sibling)
                .item(&create_sibling_above)
                .separator()
                .item(&edit_node)
                .item(&delete_node)
                .separator()
                .item(&toggle_collapse)
                .item(&toggle_collapse_all)
                .separator()
                .item(&open_icon_picker)
                .item(&add_link)
                .build()?;

            // === Window menu ===
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .build()?;

            // Build the full menu bar
            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&node_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            let event_name = match event.id().as_ref() {
                "new" => Some("menu-new"),
                "open" => Some("menu-open"),
                "save" => Some("menu-save"),
                "save_as" => Some("menu-save-as"),
                "copy_for_miro" => Some("menu-copy-for-miro"),
                "view_mindmap" => Some("menu-view-mindmap"),
                "view_outline" => Some("menu-view-outline"),
                "find" => Some("menu-find"),
                "create_child" => Some("menu-create-child"),
                "create_sibling" => Some("menu-create-sibling"),
                "create_sibling_above" => Some("menu-create-sibling-above"),
                "edit_node" => Some("menu-edit-node"),
                "delete_node" => Some("menu-delete-node"),
                "toggle_collapse" => Some("menu-toggle-collapse"),
                "toggle_collapse_all" => Some("menu-toggle-collapse-all"),
                "open_icon_picker" => Some("menu-open-icon-picker"),
                "add_link" => Some("menu-add-link"),
                _ => None,
            };

            if let Some(name) = event_name {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit(name, ());
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
