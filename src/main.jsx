import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App.jsx";
import Panel from "./panel/Panel.jsx";
import "./index.css";
// macOS design-system foundation (tokens, typography, scrollbars) — load last
// so its variables/utilities layer on top of Tailwind base and App.css.
import "./styles/macui.css";
// Syntax highlighting theme for note code blocks (highlight.js)
import "highlight.js/styles/github-dark.css";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { SettingsProvider } from "./contexts/SettingsContext.jsx";
import { CardsProvider } from "./contexts/CardsContext.jsx";
import { AuthProvider } from './contexts/AuthContext.jsx';
import KandooToaster from "./components/KandooToaster.jsx";

// Both desktop windows (main + menu-bar panel) load this same bundle; branch
// the rendered surface on the Tauri window label.
let windowLabel = "main";
try { if (isTauri()) windowLabel = getCurrentWindow().label; } catch { /* browser */ }
const isPanel = windowLabel === "panel";
const Router = isTauri() ? HashRouter : BrowserRouter;
if (isPanel) document.documentElement.classList.add("is-panel-window");

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router>
      <ThemeProvider>
        <SettingsProvider>
          <AuthProvider>
            <CardsProvider>
              {isPanel ? <Panel /> : <App />}
              <KandooToaster />
            </CardsProvider>
          </AuthProvider>
        </SettingsProvider>
      </ThemeProvider>
    </Router>
  </StrictMode>
);
