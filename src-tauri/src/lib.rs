use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

/// Show/hide the quick-access panel, positioning it just under the menu-bar icon.
fn toggle_panel(app: &tauri::AppHandle, anchor: Option<PhysicalPosition<f64>>) {
    let Some(panel) = app.get_webview_window("panel") else {
        return;
    };

    if panel.is_visible().unwrap_or(false) {
        let _ = panel.hide();
        return;
    }

    if let Some(pos) = anchor {
        let width = panel.outer_size().map(|s| s.width as f64).unwrap_or(360.0);
        let x = (pos.x - width / 2.0).max(8.0);
        let y = pos.y + 8.0;
        let _ = panel.set_position(PhysicalPosition::new(x, y));
    }
    let _ = panel.show();
    let _ = panel.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "create_local_workspace_state",
        sql: "CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
              );",
        kind: MigrationKind::Up,
    }];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kandoo.db", migrations)
                .build(),
        )
        .setup(|app| {
            // ── Menu-bar tray icon ─────────────────────────────────────────
            let open_item = MenuItem::with_id(app, "open", "Open Kandoo", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Kandoo", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("kandoo-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Kandoo")
                .menu(&menu)
                // Left click toggles the quick panel; right click shows the menu.
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.unminimize();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        position,
                        ..
                    } = event
                    {
                        toggle_panel(tray.app_handle(), Some(position));
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            // The panel is ephemeral — dismiss it when it loses focus.
            WindowEvent::Focused(false) if window.label() == "panel" => {
                let _ = window.hide();
            }
            // Closing the main window keeps Kandoo alive in the menu bar
            // (the tray "Quit Kandoo" item is the real exit).
            WindowEvent::CloseRequested { api, .. } if window.label() == "main" => {
                api.prevent_close();
                let _ = window.hide();
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building Kandoo")
        .run(|app, event| {
            // macOS dock-icon click reopens the main window.
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
        });
}
