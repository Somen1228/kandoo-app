#[cfg(target_os = "macos")]
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};

// Embedded dock-icon variants — swapped when the window is minimized/restored.
#[cfg(target_os = "macos")]
const ICON_AWAKE: &[u8] = include_bytes!("../icons/icon.png");
#[cfg(target_os = "macos")]
const ICON_SLEEP: &[u8] = include_bytes!("../icons/icon-sleep.png");
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::{Duration, Instant},
};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_sql::{Migration, MigrationKind};
use url::Url;

const GOOGLE_AUTHORIZE_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const OAUTH_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleOauthTokens {
    access_token: String,
    id_token: String,
}

#[derive(Deserialize)]
struct GoogleTokenResponse {
    access_token: Option<String>,
    id_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

fn random_urlsafe(byte_count: usize) -> String {
    let mut bytes = vec![0_u8; byte_count];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn browser_response(title: &str, message: &str, success: bool) -> String {
    let color = if success { "#22c55e" } else { "#ef4444" };
    let icon = if success {
        "<svg viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='20 6 9 17 4 12'/></svg>"
    } else {
        "<svg viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><line x1='18' y1='6' x2='6' y2='18'/><line x1='6' y1='6' x2='18' y2='18'/></svg>"
    };
    let body = format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>{title}</title><style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;color:#f8fafc;font:16px system-ui,-apple-system,sans-serif}}main{{max-width:440px;padding:40px;text-align:center}}i{{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:{color};margin-bottom:20px}}i svg{{width:28px;height:28px}}h1{{font-size:24px;margin:0 0 10px}}p{{color:#cbd5e1;line-height:1.55}}</style></head><body><main><i>{icon}</i><h1>{title}</h1><p>{message}</p></main></body></html>"
    );
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    )
}

fn wait_for_google_callback(listener: TcpListener, expected_state: String) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("Could not configure the Google sign-in callback: {error}"))?;
    let deadline = Instant::now() + OAUTH_TIMEOUT;

    while Instant::now() < deadline {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let mut buffer = [0_u8; 8192];
                let read = stream
                    .read(&mut buffer)
                    .map_err(|error| format!("Could not read the Google sign-in callback: {error}"))?;
                let request = String::from_utf8_lossy(&buffer[..read]);
                let target = request
                    .lines()
                    .next()
                    .and_then(|line| line.split_whitespace().nth(1))
                    .ok_or_else(|| "Google returned an invalid sign-in callback".to_string())?;
                let callback = Url::parse(&format!("http://127.0.0.1{target}"))
                    .map_err(|_| "Google returned an invalid sign-in callback URL".to_string())?;
                let params = callback.query_pairs().collect::<std::collections::HashMap<_, _>>();

                if params.get("state").map(|value| value.as_ref()) != Some(expected_state.as_str()) {
                    let response = browser_response(
                        "Sign-in request rejected",
                        "The callback could not be verified. Return to Kandoo and try again.",
                        false,
                    );
                    let _ = stream.write_all(response.as_bytes());
                    continue;
                }

                if let Some(error) = params.get("error") {
                    let response = browser_response(
                        "Google sign-in cancelled",
                        "No changes were made. You can close this tab and return to Kandoo.",
                        false,
                    );
                    let _ = stream.write_all(response.as_bytes());
                    return Err(if error == "access_denied" {
                        "Google sign-in was cancelled".to_string()
                    } else {
                        format!("Google sign-in failed: {error}")
                    });
                }

                let code = params
                    .get("code")
                    .map(|value| value.to_string())
                    .ok_or_else(|| "Google did not return an authorization code".to_string())?;
                let response = browser_response(
                    "Signed in to Kandoo",
                    "Authentication is complete. You can close this tab and return to the app.",
                    true,
                );
                let _ = stream.write_all(response.as_bytes());
                return Ok(code);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(error) => return Err(format!("Google sign-in callback failed: {error}")),
        }
    }

    Err("Google sign-in timed out. Return to Kandoo and try again.".to_string())
}

#[tauri::command]
async fn google_oauth_sign_in(
    app: tauri::AppHandle,
    client_id: String,
    client_secret: Option<String>,
) -> Result<GoogleOauthTokens, String> {
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, client_id, client_secret);
        return Err("Desktop Google sign-in is not available on this platform yet".to_string());
    }

    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        if client_id.trim().is_empty() {
            return Err("Desktop Google OAuth is not configured".to_string());
        }
        let client_secret = client_secret.unwrap_or_default();

        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|error| format!("Could not start the Google sign-in callback: {error}"))?;
        let port = listener
            .local_addr()
            .map_err(|error| format!("Could not read the Google sign-in callback address: {error}"))?
            .port();
        let redirect_uri = format!("http://127.0.0.1:{port}");
        let state = random_urlsafe(32);
        let code_verifier = random_urlsafe(64);
        let code_challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(code_verifier.as_bytes()));

        let mut authorize_url = Url::parse(GOOGLE_AUTHORIZE_URL)
            .map_err(|error| format!("Could not prepare Google sign-in: {error}"))?;
        authorize_url
            .query_pairs_mut()
            .append_pair("client_id", client_id.trim())
            .append_pair("redirect_uri", &redirect_uri)
            .append_pair("response_type", "code")
            .append_pair("scope", "openid email profile")
            .append_pair("state", &state)
            .append_pair("code_challenge", &code_challenge)
            .append_pair("code_challenge_method", "S256")
            .append_pair("prompt", "select_account");

        app.opener()
            .open_url(authorize_url.as_str(), None::<&str>)
            .map_err(|error| format!("Could not open the system browser: {error}"))?;

        let callback_state = state.clone();
        let code = tauri::async_runtime::spawn_blocking(move || {
            wait_for_google_callback(listener, callback_state)
        })
        .await
        .map_err(|error| format!("Google sign-in callback stopped unexpectedly: {error}"))??;

        let mut form_fields = vec![
            ("client_id", client_id.trim().to_string()),
            ("code", code.clone()),
            ("code_verifier", code_verifier.clone()),
            ("grant_type", "authorization_code".to_string()),
            ("redirect_uri", redirect_uri.clone()),
        ];
        if !client_secret.trim().is_empty() {
            form_fields.push(("client_secret", client_secret.trim().to_string()));
        }

        let response = reqwest::Client::new()
            .post(GOOGLE_TOKEN_URL)
            .form(&form_fields)
            .send()
            .await
            .map_err(|error| format!("Could not exchange the Google authorization code: {error}"))?;
        let status = response.status();
        let payload: GoogleTokenResponse = response
            .json()
            .await
            .map_err(|error| format!("Google returned an invalid token response: {error}"))?;

        if !status.is_success() {
            return Err(payload
                .error_description
                .or(payload.error)
                .unwrap_or_else(|| format!("Google token exchange failed ({status})")));
        }

        let access_token = payload
            .access_token
            .ok_or_else(|| "Google did not return an access token".to_string())?;
        let id_token = payload
            .id_token
            .ok_or_else(|| "Google did not return an ID token".to_string())?;
        Ok(GoogleOauthTokens { access_token, id_token })
    }
}

/// Show/hide the quick-access panel, positioning it just under the menu-bar icon.
#[cfg(target_os = "macos")]
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

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:kandoo.db", migrations)
                .build(),
        );

    #[cfg(target_os = "macos")]
    let builder = builder
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
            // Dock icon: check for minimize after a short delay so the animation
            // completes before is_minimized() is read (Focused fires before the
            // window actually lands in the dock).
            WindowEvent::Focused(false) if window.label() == "main" => {
                let app = window.app_handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_millis(250));
                    if let Some(w) = app.get_webview_window("main") {
                        if w.is_minimized().unwrap_or(false) {
                            if let Ok(icon) = Image::from_bytes(ICON_SLEEP) {
                                let _ = w.set_icon(icon);
                            }
                        }
                    }
                });
            }
            // Restore awake icon the moment the window regains focus.
            WindowEvent::Focused(true) if window.label() == "main" => {
                let app = window.app_handle().clone();
                if let Some(w) = app.get_webview_window("main") {
                    if let Ok(icon) = Image::from_bytes(ICON_AWAKE) {
                        let _ = w.set_icon(icon);
                    }
                }
            }
            _ => {}
        });

    builder
        .invoke_handler(tauri::generate_handler![google_oauth_sign_in])
        .build(tauri::generate_context!())
        .expect("error while building Kandoo")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            // macOS dock-icon click reopens the main window.
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }

            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
