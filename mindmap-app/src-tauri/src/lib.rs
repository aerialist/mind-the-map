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

// Save PDF file (from base64 encoded content)
#[tauri::command]
fn save_pdf(path: String, content: String) -> Result<(), String> {
    use std::io::Write;
    
    // Decode base64
    let decoded = base64::decode(&content).map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    let temp_path = format!("{}.tmp", path);

    // Write to temp file first
    let mut file = fs::File::create(&temp_path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&decoded).map_err(|e| format!("Failed to write file: {}", e))?;

    // Rename temp file to target (atomic on most file systems)
    fs::rename(&temp_path, &path).map_err(|e| {
        // Clean up temp file if rename fails
        let _ = fs::remove_file(&temp_path);
        format!("Failed to save file: {}", e)
    })?;

    Ok(())
}

// Get app version
#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Get platform information
#[tauri::command]
fn get_platform_info() -> String {
    #[cfg(target_os = "macos")]
    {
        #[cfg(target_arch = "aarch64")]
        return "macOS (Apple Silicon)".to_string();
        
        #[cfg(target_arch = "x86_64")]
        return "macOS (Intel)".to_string();
    }
    
    #[cfg(target_os = "windows")]
    return "Windows".to_string();
    
    #[cfg(target_os = "linux")]
    return "Linux".to_string();
    
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return std::env::consts::OS.to_string();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![save_document, read_document, save_pdf, get_app_version, get_platform_info])
        .setup(|app| {
            // Handle file opens from macOS (when .mindmap file is double-clicked)
            #[cfg(target_os = "macos")]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let app_handle = app.handle().clone();
                
                // Register deep link handler
                app.deep_link().register_all()?;
                
                // Check for URLs passed at startup (cold launch with file)
                if let Ok(urls) = app.deep_link().get_current() {
                    for url in urls.iter().flatten() {
                        let url_str = url.as_str();
                        let path = if url_str.starts_with("file://") {
                            urlencoding::decode(url_str.strip_prefix("file://").unwrap_or(url_str))
                                .unwrap_or_default()
                                .to_string()
                        } else {
                            url_str.to_string()
                        };
                        
                        if path.ends_with(".mindmap") {
                            let app_handle_clone = app_handle.clone();
                            let path_clone = path.clone();
                            std::thread::spawn(move || {
                                for _attempt in 1..=10 {
                                    std::thread::sleep(std::time::Duration::from_millis(300));
                                    if let Some(window) = app_handle_clone.get_webview_window("main") {
                                        let encoded_path = urlencoding::encode(&path_clone);
                                        let url = format!("tauri://localhost?file={}", encoded_path);
                                        if let Ok(parsed_url) = url.parse() {
                                            if window.navigate(parsed_url).is_ok() {
                                                break;
                                            }
                                        }
                                    }
                                }
                            });
                            break; // Only handle first file
                        }
                    }
                }
                
                // Handle files opened while app is already running (warm launch)
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let url_str = url.as_str();
                        
                        // Convert file:// URL to local path (URL decode it)
                        let path = if url_str.starts_with("file://") {
                            urlencoding::decode(url_str.strip_prefix("file://").unwrap_or(url_str))
                                .unwrap_or_default()
                                .to_string()
                        } else {
                            url_str.to_string()
                        };
                        
                        if path.ends_with(".mindmap") {
                            if let Some(window) = app_handle.get_webview_window("main")
                                .or_else(|| app_handle.webview_windows().values().next().cloned()) {
                                let encoded_path = urlencoding::encode(&path);
                                let url = format!("tauri://localhost?file={}", encoded_path);
                                if let Ok(parsed_url) = url.parse() {
                                    let _ = window.navigate(parsed_url);
                                }
                            }
                        }
                    }
                });

                // Check command line arguments at startup (when app is launched by double-clicking a file)
                let app_handle_startup = app.handle().clone();
                std::thread::spawn(move || {
                    let args: Vec<String> = std::env::args().collect();
                    
                    for arg in args.iter().skip(1) {
                        if arg.ends_with(".mindmap") && std::path::Path::new(arg).exists() {
                            // Wait for window to be ready
                            for _attempt in 1..=10 {
                                std::thread::sleep(std::time::Duration::from_millis(300));
                                
                                if let Some(window) = app_handle_startup.get_webview_window("main") {
                                    // URL encode the file path
                                    let encoded_path = urlencoding::encode(arg);
                                    
                                    // Build URL with file parameter
                                    let url = if cfg!(debug_assertions) {
                                        format!("http://localhost:1420?file={}", encoded_path)
                                    } else {
                                        format!("tauri://localhost?file={}", encoded_path)
                                    };
                                    
                                    // Navigate to URL with file parameter
                                    if let Ok(parsed_url) = url.parse() {
                                        if window.navigate(parsed_url).is_ok() {
                                            break;
                                        }
                                    }
                                }
                            }
                            break; // Only open the first file
                        }
                    }
                });
            }

            // Handle file opens from Windows (when .mindmap file is double-clicked)
            // Windows passes the file path as a command-line argument
            #[cfg(target_os = "windows")]
            {
                let app_handle_startup = app.handle().clone();
                std::thread::spawn(move || {
                    let args: Vec<String> = std::env::args().collect();
                    
                    for arg in args.iter().skip(1) {
                        if arg.ends_with(".mindmap") && std::path::Path::new(arg).exists() {
                            // Wait for window to be ready
                            for _attempt in 1..=10 {
                                std::thread::sleep(std::time::Duration::from_millis(300));
                                
                                if let Some(window) = app_handle_startup.get_webview_window("main") {
                                    // URL encode the file path
                                    let encoded_path = urlencoding::encode(arg);
                                    
                                    // Build URL with file parameter
                                    let url = if cfg!(debug_assertions) {
                                        format!("http://localhost:1420?file={}", encoded_path)
                                    } else {
                                        format!("https://tauri.localhost?file={}", encoded_path)
                                    };
                                    
                                    // Navigate to URL with file parameter
                                    if let Ok(parsed_url) = url.parse() {
                                        if window.navigate(parsed_url).is_ok() {
                                            break;
                                        }
                                    }
                                }
                            }
                            break; // Only open the first file
                        }
                    }
                });
            }

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
            let print_item = MenuItemBuilder::with_id("print", "Print / Export PDF...")
                .accelerator("CmdOrCtrl+P")
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
                .item(&print_item)
                .separator()
                .item(&PredefinedMenuItem::close_window(app, None)?)
                .build()?;

            // === Edit menu items ===
            // Use custom menu items for copy/cut/paste so JavaScript handles them
            // (PredefinedMenuItem clipboard items intercept at OS level before JS sees them)
            let undo_item = MenuItemBuilder::with_id("undo", "Undo")
                .accelerator("CmdOrCtrl+Z")
                .build(app)?;
            let redo_item = MenuItemBuilder::with_id("redo", "Redo")
                .accelerator("CmdOrCtrl+Shift+Z")
                .build(app)?;
            let cut_item = MenuItemBuilder::with_id("cut", "Cut")
                .accelerator("CmdOrCtrl+X")
                .build(app)?;
            let copy_item = MenuItemBuilder::with_id("copy", "Copy")
                .accelerator("CmdOrCtrl+C")
                .build(app)?;
            let paste_item = MenuItemBuilder::with_id("paste", "Paste")
                .accelerator("CmdOrCtrl+V")
                .build(app)?;
            let copy_for_miro = MenuItemBuilder::with_id("copy_for_miro", "Copy for Miro")
                .accelerator("CmdOrCtrl+Shift+M")
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&undo_item)
                .item(&redo_item)
                .separator()
                .item(&cut_item)
                .item(&copy_item)
                .item(&paste_item)
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
            let fit_to_view = MenuItemBuilder::with_id("fit_to_view", "Fit to View")
                .accelerator("CmdOrCtrl+0")
                .build(app)?;
            let find = MenuItemBuilder::with_id("find", "Find...")
                .accelerator("CmdOrCtrl+F")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&mindmap_mode)
                .item(&outline_mode)
                .separator()
                .item(&fit_to_view)
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

            // === Help menu items ===
            let about_item = MenuItemBuilder::with_id("about", "About Mind the Map")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&about_item)
                .build()?;

            // Build the full menu bar
            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&node_menu)
                .item(&window_menu)
                .item(&help_menu)
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
                "print" => Some("menu-print"),
                "undo" => Some("menu-undo"),
                "redo" => Some("menu-redo"),
                "cut" => Some("menu-cut"),
                "copy" => Some("menu-copy"),
                "paste" => Some("menu-paste"),
                "copy_for_miro" => Some("menu-copy-for-miro"),
                "view_mindmap" => Some("menu-view-mindmap"),
                "view_outline" => Some("menu-view-outline"),
                "fit_to_view" => Some("menu-fit-to-view"),
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
                "about" => Some("menu-about"),
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
