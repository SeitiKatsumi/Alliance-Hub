import { useEffect, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "next-themes";

export const THEME_STORAGE_KEY = "built-ui-theme";

function ValidateTheme() {
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    if (theme && theme !== "light" && theme !== "dark") setTheme("light");
  }, [theme, setTheme]);
  return null;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}
      storageKey={THEME_STORAGE_KEY} themes={["light", "dark"]} disableTransitionOnChange>
      <ValidateTheme />
      {children}
    </ThemeProvider>
  );
}
