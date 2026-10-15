import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { AppThemeProvider } from "./components/theme-provider";

createRoot(document.getElementById("root")!).render(<AppThemeProvider><App /></AppThemeProvider>);
