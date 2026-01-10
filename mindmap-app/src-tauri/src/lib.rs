use std::fs;
use std::path::Path;
use std::sync::Mutex;
use serde::Serialize;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};
use tauri::{Emitter, Manager, State, WindowEvent};

// Track the active window label
struct AppState {
    active_label: Mutex<Option<String>>,
}

#[derive(Clone, Serialize)]
struct CommandDispatchPayload {
    id: String,
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

// Track the currently active window label from the frontend
#[tauri::command]
fn window_activated(label: String, state: State<AppState>) {
    if let Ok(mut active_label) = state.active_label.lock() {
        *active_label = Some(label);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .invoke_handler(tauri::generate_handler![
            save_document,
            read_document,
            save_pdf,
            get_app_version,
            get_platform_info,
            window_activated
        ])
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
            let new_doc = MenuItemBuilder::with_id("new", "New Document")
                .accelerator("CmdOrCtrl+N")
                .build(app)?;
            let open_doc = MenuItemBuilder::with_id("open", "Open...")
                .accelerator("CmdOrCtrl+O")
                .build(app)?;
            let open_recent_placeholder = MenuItemBuilder::with_id("open_recent_placeholder", "No Recent Files")
                .enabled(false)
                .build(app)?;
            let open_recent_menu = SubmenuBuilder::new(app, "Open Recent")
                .item(&open_recent_placeholder)
                .build()?;
            let save_doc = MenuItemBuilder::with_id("save", "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?;
            let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?;
            let export_pdf = MenuItemBuilder::with_id("export_pdf", "Export as PDF")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?;
            let export_markdown = MenuItemBuilder::with_id("export_markdown", "Export as Markdown")
                .enabled(false)
                .build(app)?;
            let export_plain_text = MenuItemBuilder::with_id("export_plain_text", "Export as Plain Text")
                .enabled(false)
                .build(app)?;
            let export_image = MenuItemBuilder::with_id("export_image", "Export as Image (Mindmap)")
                .enabled(false)
                .build(app)?;
            let export_menu = SubmenuBuilder::new(app, "Export")
                .item(&export_pdf)
                .item(&export_markdown)
                .item(&export_plain_text)
                .item(&export_image)
                .build()?;
            let print_item = MenuItemBuilder::with_id("print", "Print...")
                .accelerator("CmdOrCtrl+P")
                .build(app)?;
            let preferences_item = MenuItemBuilder::with_id("preferences", "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .enabled(false)
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_doc)
                .item(&open_doc)
                .item(&open_recent_menu)
                .separator()
                .item(&save_doc)
                .item(&save_as)
                .separator()
                .item(&export_menu)
                .separator()
                .item(&print_item)
                .separator()
                .item(&preferences_item)
                .separator()
                .item(&PredefinedMenuItem::quit(app, None)?)
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
            let paste_as_child = MenuItemBuilder::with_id("paste_as_child", "Paste as Child")
                .accelerator("CmdOrCtrl+Shift+V")
                .build(app)?;
            let duplicate_node = MenuItemBuilder::with_id("duplicate_node", "Duplicate Node")
                .accelerator("CmdOrCtrl+D")
                .enabled(false)
                .build(app)?;
            let delete_node = MenuItemBuilder::with_id("delete_node", "Delete Node")
                .accelerator("CmdOrCtrl+Backspace")
                .build(app)?;
            let delete_node_with_children = MenuItemBuilder::with_id("delete_node_with_children", "Delete Node & Children")
                .accelerator("CmdOrCtrl+Shift+Backspace")
                .enabled(false)
                .build(app)?;
            let select_all_siblings = MenuItemBuilder::with_id("select_all_siblings", "Select All Siblings")
                .accelerator("CmdOrCtrl+Shift+A")
                .enabled(false)
                .build(app)?;
            let select_all_children = MenuItemBuilder::with_id("select_all_children", "Select All Children")
                .accelerator("CmdOrCtrl+Alt+A")
                .enabled(false)
                .build(app)?;
            let find_item = MenuItemBuilder::with_id("find", "Find...")
                .accelerator("CmdOrCtrl+F")
                .build(app)?;
            let find_next = MenuItemBuilder::with_id("find_next", "Find Next")
                .accelerator("CmdOrCtrl+G")
                .enabled(false)
                .build(app)?;
            let find_previous = MenuItemBuilder::with_id("find_previous", "Find Previous")
                .accelerator("CmdOrCtrl+Shift+G")
                .enabled(false)
                .build(app)?;
            let go_to_node = MenuItemBuilder::with_id("go_to_node", "Go to Node...")
                .accelerator("CmdOrCtrl+Shift+P")
                .enabled(false)
                .build(app)?;
            let jump_daily_note = MenuItemBuilder::with_id("jump_daily_note", "Jump to Daily Note")
                .accelerator("CmdOrCtrl+Shift+D")
                .enabled(false)
                .build(app)?;
            let recent_nodes = MenuItemBuilder::with_id("recent_nodes", "Recent Nodes")
                .accelerator("CmdOrCtrl+R")
                .enabled(false)
                .build(app)?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .item(&undo_item)
                .item(&redo_item)
                .separator()
                .item(&cut_item)
                .item(&copy_item)
                .item(&paste_item)
                .item(&paste_as_child)
                .separator()
                .item(&duplicate_node)
                .item(&delete_node)
                .item(&delete_node_with_children)
                .separator()
                .item(&PredefinedMenuItem::select_all(app, Some("Select All (in text)"))?)
                .item(&select_all_siblings)
                .item(&select_all_children)
                .separator()
                .item(&find_item)
                .item(&find_next)
                .item(&find_previous)
                .separator()
                .item(&go_to_node)
                .item(&jump_daily_note)
                .item(&recent_nodes)
                .build()?;

            // === Insert menu items ===
            let insert_sibling_below = MenuItemBuilder::with_id("insert_sibling_below", "New Sibling Node Below")
                .accelerator("Enter")
                .build(app)?;
            let insert_sibling_above = MenuItemBuilder::with_id("insert_sibling_above", "New Sibling Node Above")
                .accelerator("CmdOrCtrl+Shift+Enter")
                .build(app)?;
            let insert_child = MenuItemBuilder::with_id("insert_child", "New Child Node")
                .accelerator("Tab")
                .build(app)?;
            let line_break = MenuItemBuilder::with_id("line_break", "Line Break (in node)")
                .accelerator("Shift+Enter")
                .enabled(false)
                .build(app)?;
            let insert_link = MenuItemBuilder::with_id("insert_link", "Link...")
                .accelerator("CmdOrCtrl+K")
                .build(app)?;
            let insert_tag = MenuItemBuilder::with_id("insert_tag", "Tag")
                .accelerator("CmdOrCtrl+T")
                .enabled(false)
                .build(app)?;
            let insert_note = MenuItemBuilder::with_id("insert_note", "Note")
                .accelerator("CmdOrCtrl+Shift+N")
                .enabled(false)
                .build(app)?;
            let insert_icon = MenuItemBuilder::with_id("insert_icon", "Icon...")
                .accelerator("CmdOrCtrl+Shift+I")
                .build(app)?;
            let insert_checkbox = MenuItemBuilder::with_id("insert_checkbox", "Checkbox")
                .accelerator("CmdOrCtrl+Shift+C")
                .enabled(false)
                .build(app)?;
            let insert_color_style = MenuItemBuilder::with_id("insert_color_style", "Color/Style...")
                .accelerator("CmdOrCtrl+Shift+K")
                .enabled(false)
                .build(app)?;
            let insert_priority = MenuItemBuilder::with_id("insert_priority", "Priority")
                .accelerator("CmdOrCtrl+Shift+P")
                .enabled(false)
                .build(app)?;

            let insert_menu = SubmenuBuilder::new(app, "Insert")
                .item(&insert_sibling_below)
                .item(&insert_sibling_above)
                .item(&insert_child)
                .separator()
                .item(&line_break)
                .separator()
                .item(&insert_link)
                .item(&insert_tag)
                .item(&insert_note)
                .separator()
                .item(&insert_icon)
                .item(&insert_checkbox)
                .item(&insert_color_style)
                .item(&insert_priority)
                .build()?;

            // === Format menu items ===
            let format_bold = MenuItemBuilder::with_id("format_bold", "Bold")
                .accelerator("CmdOrCtrl+B")
                .enabled(false)
                .build(app)?;
            let format_italic = MenuItemBuilder::with_id("format_italic", "Italic")
                .accelerator("CmdOrCtrl+I")
                .enabled(false)
                .build(app)?;
            let format_underline = MenuItemBuilder::with_id("format_underline", "Underline")
                .accelerator("CmdOrCtrl+U")
                .enabled(false)
                .build(app)?;
            let format_strikethrough = MenuItemBuilder::with_id("format_strikethrough", "Strikethrough")
                .accelerator("CmdOrCtrl+Shift+X")
                .enabled(false)
                .build(app)?;
            let format_code = MenuItemBuilder::with_id("format_code", "Code")
                .accelerator("CmdOrCtrl+E")
                .enabled(false)
                .build(app)?;
            let format_clear = MenuItemBuilder::with_id("format_clear", "Clear Formatting")
                .accelerator("CmdOrCtrl+\\")
                .enabled(false)
                .build(app)?;

            let format_menu = SubmenuBuilder::new(app, "Format")
                .item(&format_bold)
                .item(&format_italic)
                .item(&format_underline)
                .item(&format_strikethrough)
                .item(&format_code)
                .separator()
                .item(&format_clear)
                .build()?;

            // === Node menu items ===
            let node_indent = MenuItemBuilder::with_id("node_indent", "Indent")
                .accelerator("CmdOrCtrl+]")
                .build(app)?;
            let node_outdent = MenuItemBuilder::with_id("node_outdent", "Outdent")
                .accelerator("CmdOrCtrl+[")
                .build(app)?;
            let node_move_up = MenuItemBuilder::with_id("node_move_up", "Move Node Up")
                .accelerator("CmdOrCtrl+Shift+Up")
                .enabled(false)
                .build(app)?;
            let node_move_down = MenuItemBuilder::with_id("node_move_down", "Move Node Down")
                .accelerator("CmdOrCtrl+Shift+Down")
                .enabled(false)
                .build(app)?;
            let node_move_left = MenuItemBuilder::with_id("node_move_left", "Move Node Left (Outdent)")
                .accelerator("CmdOrCtrl+Shift+Left")
                .enabled(false)
                .build(app)?;
            let node_move_right = MenuItemBuilder::with_id("node_move_right", "Move Node Right (Indent)")
                .accelerator("CmdOrCtrl+Shift+Right")
                .enabled(false)
                .build(app)?;
            let node_toggle_collapse = MenuItemBuilder::with_id("node_toggle_collapse", "Expand/Collapse")
                .accelerator("Space")
                .build(app)?;
            let node_expand_all = MenuItemBuilder::with_id("node_expand_all", "Expand All Children")
                .accelerator("CmdOrCtrl+Alt+Right")
                .enabled(false)
                .build(app)?;
            let node_collapse_all = MenuItemBuilder::with_id("node_collapse_all", "Collapse All Children")
                .accelerator("CmdOrCtrl+Alt+Left")
                .enabled(false)
                .build(app)?;
            let node_zoom_to = MenuItemBuilder::with_id("node_zoom_to", "Zoom to Node (Focus)")
                .accelerator("CmdOrCtrl+.")
                .enabled(false)
                .build(app)?;
            let node_zoom_out = MenuItemBuilder::with_id("node_zoom_out", "Zoom Out from Node")
                .accelerator("CmdOrCtrl+,")
                .enabled(false)
                .build(app)?;
            let node_jump_root = MenuItemBuilder::with_id("node_jump_root", "Jump to Root")
                .accelerator("CmdOrCtrl+Home")
                .enabled(false)
                .build(app)?;

            let node_menu = SubmenuBuilder::new(app, "Node")
                .item(&node_indent)
                .item(&node_outdent)
                .separator()
                .item(&node_move_up)
                .item(&node_move_down)
                .item(&node_move_left)
                .item(&node_move_right)
                .separator()
                .item(&node_toggle_collapse)
                .item(&node_expand_all)
                .item(&node_collapse_all)
                .separator()
                .item(&node_zoom_to)
                .item(&node_zoom_out)
                .item(&node_jump_root)
                .build()?;

            // === Navigate menu items ===
            let nav_sibling_up = MenuItemBuilder::with_id("nav_sibling_up", "Move to Sibling Above")
                .accelerator("Up")
                .build(app)?;
            let nav_sibling_down = MenuItemBuilder::with_id("nav_sibling_down", "Move to Sibling Below")
                .accelerator("Down")
                .build(app)?;
            let nav_first_child = MenuItemBuilder::with_id("nav_first_child", "Move to First Child")
                .accelerator("Right")
                .build(app)?;
            let nav_parent = MenuItemBuilder::with_id("nav_parent", "Move to Parent")
                .accelerator("Left")
                .build(app)?;
            let nav_first_sibling = MenuItemBuilder::with_id("nav_first_sibling", "Jump to First Sibling")
                .accelerator("CmdOrCtrl+Up")
                .enabled(false)
                .build(app)?;
            let nav_last_sibling = MenuItemBuilder::with_id("nav_last_sibling", "Jump to Last Sibling")
                .accelerator("CmdOrCtrl+Down")
                .enabled(false)
                .build(app)?;
            let nav_last_child = MenuItemBuilder::with_id("nav_last_child", "Jump to Last Child")
                .accelerator("CmdOrCtrl+Right")
                .enabled(false)
                .build(app)?;
            let nav_extend_up = MenuItemBuilder::with_id("nav_extend_up", "Extend Selection Up")
                .accelerator("Shift+Up")
                .enabled(false)
                .build(app)?;
            let nav_extend_down = MenuItemBuilder::with_id("nav_extend_down", "Extend Selection Down")
                .accelerator("Shift+Down")
                .enabled(false)
                .build(app)?;
            let nav_select_toggle = MenuItemBuilder::with_id("nav_select_toggle", "Select/Deselect Node")
                .accelerator("CmdOrCtrl+Enter")
                .enabled(false)
                .build(app)?;

            let navigate_menu = SubmenuBuilder::new(app, "Navigate")
                .item(&nav_sibling_up)
                .item(&nav_sibling_down)
                .item(&nav_first_child)
                .item(&nav_parent)
                .separator()
                .item(&nav_first_sibling)
                .item(&nav_last_sibling)
                .item(&nav_last_child)
                .separator()
                .item(&nav_extend_up)
                .item(&nav_extend_down)
                .separator()
                .item(&nav_select_toggle)
                .build()?;

            // === View menu items ===
            let view_toggle = MenuItemBuilder::with_id("view_toggle", "Toggle Outline ↔ Mindmap")
                .accelerator("CmdOrCtrl+M")
                .build(app)?;
            let view_mindmap = MenuItemBuilder::with_id("view_mindmap", "Switch to Mind Map")
                .accelerator("CmdOrCtrl+1")
                .build(app)?;
            let view_outline = MenuItemBuilder::with_id("view_outline", "Switch to Outline")
                .accelerator("CmdOrCtrl+2")
                .build(app)?;
            let view_zoom_in = MenuItemBuilder::with_id("view_zoom_in", "Zoom In")
                .accelerator("CmdOrCtrl+=")
                .enabled(false)
                .build(app)?;
            let view_zoom_out = MenuItemBuilder::with_id("view_zoom_out", "Zoom Out")
                .accelerator("CmdOrCtrl+-")
                .enabled(false)
                .build(app)?;
            let view_zoom_reset = MenuItemBuilder::with_id("view_zoom_reset", "Reset Zoom")
                .accelerator("CmdOrCtrl+0")
                .enabled(false)
                .build(app)?;
            let view_fit = MenuItemBuilder::with_id("view_fit", "Fit to Screen")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(app)?;
            let view_show_completed = MenuItemBuilder::with_id("view_show_completed", "Show/Hide Completed")
                .accelerator("CmdOrCtrl+Shift+H")
                .enabled(false)
                .build(app)?;
            let view_focus_mode = MenuItemBuilder::with_id("view_focus_mode", "Focus Mode (Hide UI)")
                .accelerator("CmdOrCtrl+Shift+.")
                .enabled(false)
                .build(app)?;
            let view_toggle_sidebar = MenuItemBuilder::with_id("view_toggle_sidebar", "Toggle Sidebar")
                .accelerator("CmdOrCtrl+B")
                .enabled(false)
                .build(app)?;

            let mut view_menu = SubmenuBuilder::new(app, "View")
                .item(&view_toggle)
                .item(&view_mindmap)
                .item(&view_outline)
                .separator()
                .item(&view_zoom_in)
                .item(&view_zoom_out)
                .item(&view_zoom_reset)
                .item(&view_fit)
                .separator()
                .item(&view_show_completed)
                .item(&view_focus_mode)
                .item(&view_toggle_sidebar);

            if !cfg!(target_os = "macos") {
                view_menu = view_menu
                    .separator()
                    .item(&PredefinedMenuItem::fullscreen(app, None)?);
            }

            let view_menu = view_menu.build()?;

            // === Window menu items (macOS only) ===
            let window_menu = if cfg!(target_os = "macos") {
                Some(
                    SubmenuBuilder::new(app, "Window")
                        .item(&PredefinedMenuItem::minimize(app, None)?)
                        .item(&PredefinedMenuItem::maximize(app, None)?)
                        .separator()
                        .item(
                            &MenuItemBuilder::with_id("window_bring_all_to_front", "Bring All to Front")
                                .enabled(false)
                                .build(app)?
                        )
                        .separator()
                        .item(&PredefinedMenuItem::fullscreen(app, None)?)
                        .build()?
                )
            } else {
                None
            };

            // === Help menu items ===
            let help_shortcuts = MenuItemBuilder::with_id("help_shortcuts", "Keyboard Shortcuts")
                .accelerator("CmdOrCtrl+/")
                .build(app)?;
            let help_docs = MenuItemBuilder::with_id("help_docs", "Documentation")
                .enabled(false)
                .build(app)?;
            let help_tutorials = MenuItemBuilder::with_id("help_tutorials", "Video Tutorials")
                .enabled(false)
                .build(app)?;
            let help_updates = MenuItemBuilder::with_id("help_updates", "Check for Updates...")
                .enabled(false)
                .build(app)?;
            let help_feedback = MenuItemBuilder::with_id("help_feedback", "Send Feedback...")
                .enabled(false)
                .build(app)?;
            let about_item = MenuItemBuilder::with_id("about", "About Mind the Map")
                .build(app)?;

            let help_menu = SubmenuBuilder::new(app, "Help")
                .item(&help_shortcuts)
                .item(&help_docs)
                .item(&help_tutorials)
                .separator()
                .item(&help_updates)
                .item(&help_feedback)
                .separator()
                .item(&about_item)
                .build()?;

            // Build the full menu bar
            let mut menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&insert_menu)
                .item(&format_menu)
                .item(&node_menu)
                .item(&navigate_menu)
                .item(&view_menu);

            if let Some(window_menu) = &window_menu {
                menu = menu.item(window_menu);
            }

            let menu = menu
                .item(&help_menu)
                .build()?;

            app.set_menu(menu)?;

            // Initialize active window tracker with the main window
            app.manage(AppState {
                active_label: Mutex::new(Some("main".to_string())),
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::Focused(focused) if *focused => {
                    // Track window focus changes
                    if let Some(state) = window.try_state::<AppState>() {
                        if let Ok(mut label) = state.active_label.lock() {
                            *label = Some(window.label().to_string());
                        }
                    }
                }
                _ => {}
            }
        })
        .on_menu_event(|app, event| {
            let command_id = match event.id().as_ref() {
                "new" => Some("file.new"),
                "open" => Some("file.open"),
                "save" => Some("file.save"),
                "save_as" => Some("file.saveAs"),
                "export_pdf" => Some("file.print"),
                "print" => Some("file.print"),
                "undo" => Some("edit.undo"),
                "redo" => Some("edit.redo"),
                "cut" => Some("edit.cut"),
                "copy" => Some("edit.copy"),
                "paste" => Some("edit.paste"),
                "paste_as_child" => Some("edit.paste"),
                "delete_node" => Some("node.delete"),
                "insert_sibling_below" => Some("node.createSibling"),
                "insert_sibling_above" => Some("node.createSiblingAbove"),
                "insert_child" => Some("node.createChild"),
                "insert_link" => Some("node.addLink"),
                "insert_icon" => Some("node.openIconPicker"),
                "node_indent" => Some("node.indent"),
                "node_outdent" => Some("node.outdent"),
                "node_toggle_collapse" => Some("node.toggleCollapse"),
                "nav_sibling_up" => Some("navigate.siblingUp"),
                "nav_sibling_down" => Some("navigate.siblingDown"),
                "nav_first_child" => Some("navigate.firstChild"),
                "nav_parent" => Some("navigate.parent"),
                "view_toggle" => Some("view.toggle"),
                "view_mindmap" => Some("view.mindmap"),
                "view_outline" => Some("view.outline"),
                "view_fit" => Some("view.fitToView"),
                "find" => Some("view.find"),
                "help_shortcuts" => Some("app.help.toggle"),
                "about" => Some("app.about.toggle"),
                _ => None,
            };

            if let Some(id) = command_id {
                // Get the last focused window from our tracker
                let target_label = app
                    .try_state::<AppState>()
                    .and_then(|state| state.active_label.lock().ok()?.clone());

                let payload_id = id.to_string();

                if let Some(ref label) = target_label {
                    if let Some(window) = app.get_webview_window(label) {
                        let _ = window.emit(
                            "command:dispatch",
                            CommandDispatchPayload { id: payload_id.clone() },
                        );
                        return;
                    }
                }

                // Fallback: send to the first available window
                if let Some(window) = app.webview_windows().values().next() {
                    let _ = window.emit(
                        "command:dispatch",
                        CommandDispatchPayload { id: payload_id },
                    );
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
