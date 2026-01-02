use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use uuid::Uuid;

// Track the last focused window label
struct FocusedWindow(Mutex<Option<String>>);

// Store reference to Window submenu for dynamic updates
struct WindowMenuState(Mutex<Option<Submenu<tauri::Wry>>>);

// Helper function to rebuild the Window menu with current windows
fn rebuild_window_menu(app: &AppHandle) {
    let Some(menu_state) = app.try_state::<WindowMenuState>() else { return };
    let Some(window_menu) = menu_state.0.lock().ok().and_then(|m| m.clone()) else { return };
    
    // Get focused window label
    let focused_label = app
        .try_state::<FocusedWindow>()
        .and_then(|state| state.0.lock().ok()?.clone())
        .unwrap_or_default();
    
    // Clear existing items (limit iterations to prevent infinite loop)
    for _ in 0..100 {
        if window_menu.remove_at(0).is_err() {
            break;
        }
    }
    
    // Add standard items
    if let Ok(minimize) = PredefinedMenuItem::minimize(app, None) {
        let _ = window_menu.append(&minimize);
    }
    if let Ok(maximize) = PredefinedMenuItem::maximize(app, None) {
        let _ = window_menu.append(&maximize);
    }
    if let Ok(sep) = PredefinedMenuItem::separator(app) {
        let _ = window_menu.append(&sep);
    }
    
    // Add window list
    let windows = app.webview_windows();
    let mut window_labels: Vec<_> = windows.keys().cloned().collect();
    window_labels.sort(); // Sort for consistent ordering
    
    for label in window_labels {
        if let Some(window) = windows.get(&label) {
            let title = window.title().unwrap_or_else(|_| label.clone());
            let is_focused = label == focused_label;
            
            // Create check menu item with window label as ID (prefixed to avoid conflicts)
            let menu_id = format!("window-select:{}", label);
            if let Ok(item) = CheckMenuItem::with_id(app, &menu_id, &title, true, is_focused, None::<&str>) {
                let _ = window_menu.append(&item);
            }
        }
    }
}

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
            let new_window = MenuItemBuilder::with_id("new_window", "New Window")
                .accelerator("CmdOrCtrl+Shift+N")
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
                .item(&new_window)
                .separator()
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

            // === Window menu (will be dynamically populated) ===
            let window_menu = SubmenuBuilder::new(app, "Window")
                .item(&PredefinedMenuItem::minimize(app, None)?)
                .item(&PredefinedMenuItem::maximize(app, None)?)
                .separator()
                .build()?;

            // Store window menu reference for dynamic updates
            app.manage(WindowMenuState(Mutex::new(Some(window_menu.clone()))));

            // Build the full menu bar
            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&node_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            // Initialize focused window tracker with the main window
            app.manage(FocusedWindow(Mutex::new(Some("main".to_string()))));

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Focused(focused) if *focused => {
                    // Track window focus changes
                    if let Some(state) = window.try_state::<FocusedWindow>() {
                        if let Ok(mut label) = state.0.lock() {
                            *label = Some(window.label().to_string());
                        }
                    }
                    // Rebuild window menu to update checkmarks
                    rebuild_window_menu(&window.app_handle());
                }
                WindowEvent::Destroyed => {
                    // Rebuild window menu when a window is closed
                    rebuild_window_menu(&window.app_handle());
                }
                _ => {}
            }
        })
        .on_menu_event(|app, event| {
            // Handle window selection from menu
            let event_id = event.id().as_ref();
            if event_id.starts_with("window-select:") {
                let label = event_id.strip_prefix("window-select:").unwrap();
                if let Some(window) = app.get_webview_window(label) {
                    let _ = window.set_focus();
                }
                return;
            }

            // Handle new window creation separately
            if event_id == "new_window" {
                let window_id = format!("window-{}", Uuid::new_v4());
                
                // Use the same URL as the main window (works for both dev and prod)
                let url = if cfg!(debug_assertions) {
                    // In dev mode, use the dev server URL
                    WebviewUrl::External("http://localhost:1420".parse().unwrap())
                } else {
                    // In production, use the bundled app
                    WebviewUrl::App("index.html".into())
                };
                
                if let Ok(_new_window) = WebviewWindowBuilder::new(app, &window_id, url)
                    .title("Untitled — Mind the Map")
                    .inner_size(800.0, 600.0)
                    .build()
                {
                    // Rebuild window menu to include new window
                    rebuild_window_menu(app);
                }
                return;
            }

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
                // Get the last focused window from our tracker
                let target_label = app
                    .try_state::<FocusedWindow>()
                    .and_then(|state| state.0.lock().ok()?.clone());

                if let Some(ref label) = target_label {
                    if let Some(window) = app.get_webview_window(label) {
                        // Emit with the target window label as payload so frontend can filter
                        let _ = window.emit(name, label.clone());
                        return;
                    }
                }

                // Fallback: send to the first available window
                if let Some(window) = app.webview_windows().values().next() {
                    let label = window.label().to_string();
                    let _ = window.emit(name, label);
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
