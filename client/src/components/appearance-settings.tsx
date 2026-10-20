import { useTheme } from "next-themes";
import { DEFAULT_THEME } from "./theme-provider";
import { useLocale } from './preferences-provider';
import { Moon, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AppearanceSettings() {
  const { t } = useLocale();
  const { theme, setTheme } = useTheme();
  return (
    <Card data-testid="appearance-settings">
      <CardHeader>
        <CardTitle>{t('Aparência')}</CardTitle>
        <CardDescription>{t('Escolha como deseja visualizar a plataforma.')}</CardDescription>
      </CardHeader>
      <CardContent>
        <fieldset>
          <legend className="mb-3 text-sm font-medium">{t('Tema da plataforma')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["light", "dark"] as const).map((value) => {
              const selected = value === (theme === "light" ? "light" : DEFAULT_THEME);
              const Icon = value === "light" ? Sun : Moon;
              return (
                <label key={value} className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring ${selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"}`}>
                  <input type="radio" name="appearance-theme" value={value} checked={selected}
                    onChange={() => setTheme(value)} className="h-4 w-4 shrink-0 accent-blue-600"
                    data-testid={`theme-${value}`} />
                  <Icon aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{t(value === "light" ? "Claro" : "Escuro")}</span>
                    <span className="block text-xs text-muted-foreground">{t(value === DEFAULT_THEME ? "Padrão da plataforma" : "Fundos claros e textos escuros")}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <p className="mt-4 text-xs text-muted-foreground">{t('A alteração é aplicada imediatamente e fica salva neste navegador. Não altera seus dados, marcas ou documentos.')}</p>
      </CardContent>
    </Card>
  );
}
