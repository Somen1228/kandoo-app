import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
// Syntax highlighting theme for note code blocks (highlight.js)
import "highlight.js/styles/github-dark.css";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { CardsProvider } from "./contexts/CardsContext.jsx";
import KandooToaster from "./components/KandooToaster.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <CardsProvider>
        <App />
        <KandooToaster />
      </CardsProvider>
    </ThemeProvider>
  </StrictMode>
);
