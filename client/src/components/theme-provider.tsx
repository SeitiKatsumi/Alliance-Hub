import { useEffect, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";

export const THEME_STORAGE_KEY = "built-ui-theme";
export const DEFAULT_THEME = "dark";

function ValidateTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme && theme !== "light" && theme !== "dark") setTheme(DEFAULT_THEME);
  }, [theme, setTheme]);
  return null;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={DEFAULT_THEME} enableSystem={false}
      storageKey={THEME_STORAGE_KEY} themes={["light", "dark"]} disableTransitionOnChange>
      <ValidateTheme />
      {children}
    </ThemeProvider>
  );
}
