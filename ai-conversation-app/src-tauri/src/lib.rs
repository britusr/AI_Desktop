use std::sync::Mutex;
use tauri::{State, Manager, Window, AppHandle, Emitter};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState, GlobalShortcutExt};

mod config;

use config::AppConfig;

#[derive(Default)]
struct AudioState(Mutex<bool>);

#[derive(Default)]
struct SidepanelState(Mutex<bool>);

impl AudioState {
    fn new(value: bool) -> Self {
        Self(Mutex::new(value))
    }
}

impl SidepanelState {
    fn new(value: bool) -> Self {
        Self(Mutex::new(value))
    }
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn initialize_audio_system(audio_state: State<'_, AudioState>) -> Result<String, String> {
    let mut state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    *state_guard = true;
    Ok("Audio system initialized successfully".to_string())
}

#[tauri::command]
async fn start_listening(audio_state: State<'_, AudioState>) -> Result<String, String> {
    let state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    
    if *state_guard {
        Ok("Started listening".to_string())
    } else {
        Err("Audio system not initialized".to_string())
    }
}

#[tauri::command]
async fn stop_listening(audio_state: State<'_, AudioState>) -> Result<String, String> {
    let state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    
    if *state_guard {
        Ok("Stopped listening".to_string())
    } else {
        Err("Audio system not initialized".to_string())
    }
}

#[tauri::command]
async fn start_speaking(text: String, audio_state: State<'_, AudioState>) -> Result<String, String> {
    let state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    
    if *state_guard {
        Ok(format!("Started speaking: {}", text))
    } else {
        Err("Audio system not initialized".to_string())
    }
}

#[tauri::command]
async fn stop_speaking(audio_state: State<'_, AudioState>) -> Result<String, String> {
    let state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    
    if *state_guard {
        Ok("Stopped speaking".to_string())
    } else {
        Err("Audio system not initialized".to_string())
    }
}

#[tauri::command]
async fn synthesize_speech(text: String, audio_state: State<'_, AudioState>) -> Result<String, String> {
    let state_guard = audio_state.0.lock().map_err(|e| format!("Failed to lock audio state: {}", e))?;
    
    if *state_guard {
        Ok(format!("Synthesized speech for: {}", text))
    } else {
        Err("Audio system not initialized".to_string())
    }
}

#[tauri::command]
async fn show_sidepanel(app: AppHandle, sidepanel_state: State<'_, SidepanelState>) -> Result<String, String> {
    // Try to get existing window or create it if it doesn't exist
    let window = if let Some(existing_window) = app.get_webview_window("sidepanel") {
        existing_window
    } else {
        // Create the sidepanel window if it doesn't exist
        let window_builder = tauri::WebviewWindowBuilder::new(
            &app,
            "sidepanel",
            tauri::WebviewUrl::App("/sidepanel".into())
        )
        .title("AI Assistant Panel")
        .inner_size(350.0, 600.0)
        .decorations(true)
        .always_on_top(true)
        .resizable(true)
        .visible(false)
        .skip_taskbar(true);
        
        window_builder.build().map_err(|e| format!("Failed to create sidepanel window: {}", e))?
    };
    
    // Now work with the window
    {
        let mut state_guard = sidepanel_state.0.lock().map_err(|e| format!("Failed to lock sidepanel state: {}", e))?;
        
        // Always show and bring to front, regardless of current state
        // Try to position on a different monitor if available
        if let Ok(monitors) = window.available_monitors() {
            if monitors.len() > 1 {
                // Get main window position to avoid overlap
                if let Some(main_window) = app.get_webview_window("main") {
                    if let Ok(main_monitor) = main_window.current_monitor() {
                        if let Some(main_monitor) = main_monitor {
                            // Find a different monitor
                            for monitor in monitors {
                                if monitor.name() != main_monitor.name() {
                                    let monitor_pos = monitor.position();
                                    let monitor_size = monitor.size();
                                    // Position sidepanel on the right side of the secondary monitor
                                    let x = monitor_pos.x + (monitor_size.width as i32) - 400; // 400px width
                                    let y = monitor_pos.y + 100; // 100px from top
                                    
                                    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
                                        .map_err(|e| format!("Failed to set position: {}", e))?;
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        window.show().map_err(|e| format!("Failed to show window: {}", e))?;
        window.set_always_on_top(true).map_err(|e| format!("Failed to set always on top: {}", e))?;
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
        window.unminimize().map_err(|e| format!("Failed to unminimize window: {}", e))?;
        *state_guard = true;
        Ok("Sidepanel shown and focused".to_string())
    }
}

#[tauri::command]
async fn change_character_emotion(emotion: String, app: AppHandle) -> Result<String, String> {
    if let Some(main_window) = app.get_webview_window("main") {
        main_window.emit("emotion-change", emotion.clone())
            .map_err(|e| format!("Failed to emit emotion change: {}", e))?;
        Ok(format!("Emotion changed to: {}", emotion))
    } else {
        Err("Main window not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize configuration
    if let Err(e) = config::init_config() {
        eprintln!("Failed to initialize config: {}", e);
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(AudioState::new(false))
        .manage(SidepanelState::new(false))
        .invoke_handler(tauri::generate_handler![
            greet,
            initialize_audio_system,
            start_listening,
            stop_listening,
            start_speaking,
            stop_speaking,
            synthesize_speech,
            show_sidepanel,
            change_character_emotion
        ])
        .setup(|app| {
            // Register global shortcut for toggling sidepanel
            let app_handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyO);
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                // Only trigger on key press, not release
                if event.state() == ShortcutState::Pressed {
                    let app_clone = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let sidepanel_state = app_clone.state::<SidepanelState>();
                        let app_clone2 = app_clone.clone();
                        if let Err(e) = show_sidepanel(app_clone2, sidepanel_state).await {
                            eprintln!("Failed to show sidepanel: {}", e);
                        }
                    });
                }
            })?;
            
            // Register global shortcut for Ctrl+Q to quit the application
            let app_handle_quit = app.handle().clone();
            let quit_shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::KeyQ);
            app.global_shortcut().on_shortcut(quit_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    app_handle_quit.exit(0);
                }
            })?;

            // Register Esc key handler to prevent exiting fullscreen
            let esc_shortcut = Shortcut::new(None, Code::Escape);
            app.global_shortcut().on_shortcut(esc_shortcut, move |_app, _shortcut, event| {
                if event.state() == ShortcutState::Pressed {
                    // Do nothing - prevent default Esc behavior
                }
            })?;
            
            // Handle main window events
            if let Some(main_window) = app.get_webview_window("main") {
                let app_handle_close = app.handle().clone();
                main_window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { .. } => {
                            // Close all windows and quit the application
                            app_handle_close.exit(0);
                        }
                        _ => {}
                    }
                });
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
