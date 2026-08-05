import { MapPin, Mic, Paperclip, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type BrowserPermissionKind = "geolocation" | "microphone";

interface BrowserPermissionHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permission: BrowserPermissionKind;
  blocked?: boolean;
  dark?: boolean;
  onRetry: () => void | Promise<void>;
  fallbackLabel?: string;
  onFallback?: () => void;
}

interface BrowserGuide {
  browser: string;
  steps: string[];
}

function getBrowserGuide(permission: BrowserPermissionKind): BrowserGuide {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const label = permission === "geolocation" ? "Localização" : "Microfone";
  const retry = "Volte à plataforma e toque em Tentar novamente.";

  if (/SamsungBrowser/i.test(userAgent)) {
    return {
      browser: "Samsung Internet",
      steps: [
        "Toque no cadeado ao lado do endereço do site.",
        "Abra Permissões ou Permissões do site.",
        `Selecione ${label} e escolha Permitir.`,
        retry,
      ],
    };
  }

  if (/CriOS/i.test(userAgent)) {
    return {
      browser: "Chrome no iPhone",
      steps: [
        "Abra os Ajustes do iPhone e procure Chrome.",
        `Abra ${label} e escolha a opção de permissão disponível.`,
        retry,
      ],
    };
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return {
      browser: "Safari",
      steps: [
        "Toque no menu da página ao lado da barra de endereço (ícone aA ou de página).",
        "Toque em Mais e abra os Ajustes do Site.",
        `Em ${label}, selecione Permitir.`,
        retry,
      ],
    };
  }

  if (/Firefox/i.test(userAgent)) {
    return {
      browser: "Firefox",
      steps: [
        "Toque no cadeado ao lado do endereço do site.",
        "Abra as permissões do site.",
        `Remova o bloqueio de ${label} ou selecione Permitir.`,
        retry,
      ],
    };
  }

  if (/Edg/i.test(userAgent)) {
    return {
      browser: "Microsoft Edge",
      steps: [
        "Toque no cadeado ao lado do endereço do site.",
        "Abra Permissões para este site.",
        `Em ${label}, selecione Permitir.`,
        retry,
      ],
    };
  }

  if (/Chrome|Chromium/i.test(userAgent)) {
    return {
      browser: "Google Chrome",
      steps: [
        "Toque no ícone ao lado do endereço do site.",
        "Abra Permissões.",
        `Em ${label}, selecione Permitir.`,
        retry,
      ],
    };
  }

  return {
    browser: "seu navegador",
    steps: [
      "Abra as informações ou configurações deste site pelo ícone ao lado do endereço.",
      `Localize ${label} e selecione Permitir.`,
      retry,
    ],
  };
}

export function BrowserPermissionHelp({
  open,
  onOpenChange,
  permission,
  blocked = true,
  dark = false,
  onRetry,
  fallbackLabel,
  onFallback,
}: BrowserPermissionHelpProps) {
  const guide = getBrowserGuide(permission);
  const isLocation = permission === "geolocation";
  const Icon = isLocation ? MapPin : Mic;
  const title = isLocation ? "Liberar localização" : "Liberar microfone";
  const systemReminder = isLocation
    ? "Confirme também que a localização do aparelho está ativada."
    : "Se continuar bloqueado, confirme a permissão do microfone para o navegador nos Ajustes do aparelho.";

  const retry = () => {
    onOpenChange(false);
    window.setTimeout(() => void onRetry(), 150);
  };

  const fallback = () => {
    onOpenChange(false);
    window.setTimeout(() => onFallback?.(), 100);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={dark
          ? "max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border-brand-gold/20 bg-[#001428] text-white sm:w-full"
          : "max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full"}
        data-testid={`dialog-${permission}-permission-help`}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className={`flex items-center gap-2 ${dark ? "font-mono text-brand-gold" : ""}`}>
            <Icon className="h-5 w-5" />
            {title}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className={`space-y-4 text-sm ${dark ? "text-white/70" : "text-muted-foreground"}`}>
          <p>
            {blocked
              ? `A permissão está bloqueada no ${guide.browser}. Por segurança, o site não consegue abrir essa configuração interna automaticamente.`
              : `Libere a permissão no ${guide.browser} e tente novamente.`}
          </p>

          <div className={`rounded-lg border p-3 ${dark ? "border-white/10 bg-white/[0.04]" : "bg-muted/40"}`}>
            <div className={`mb-2 flex items-center gap-2 font-medium ${dark ? "text-white" : "text-foreground"}`}>
              <Settings className="h-4 w-4" />
              Como liberar no {guide.browser}
            </div>
            <ol className="space-y-2">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-2 leading-relaxed">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${dark ? "bg-white/10 text-white" : "bg-blue-100 text-blue-700"}`}>
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className={`rounded-lg border px-3 py-2 text-xs ${dark ? "border-brand-gold/20 bg-brand-gold/5 text-white/60" : "border-blue-200 bg-blue-50 text-blue-900"}`}>
            {systemReminder}
          </p>
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel className={dark ? "border-white/10 bg-transparent text-white/60 hover:text-white" : ""}>
            Agora não
          </AlertDialogCancel>
          {fallbackLabel && onFallback && (
            <Button
              type="button"
              variant="outline"
              className={dark ? "border-white/10 bg-transparent text-white/70 hover:text-white" : ""}
              onClick={fallback}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {fallbackLabel}
            </Button>
          )}
          <AlertDialogAction
            className={dark ? "font-mono font-bold" : "bg-blue-600 text-white hover:bg-blue-700"}
            style={dark ? { background: "linear-gradient(135deg,#D7BB7D,#b89a50)", color: "#001D34" } : undefined}
            onClick={retry}
            data-testid={`btn-retry-${permission}-permission`}
          >
            <Icon className="mr-2 h-4 w-4" />
            Tentar novamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
