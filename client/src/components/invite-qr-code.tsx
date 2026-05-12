import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, X } from "lucide-react";

interface InviteQrCodeProps {
  link: string;
  variant?: "dark" | "light";
}

export function InviteQrCode({ link, variant = "dark" }: InviteQrCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;

    QRCode.toDataURL(link, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: {
        dark: "#001D34",
        light: "#FFFFFF",
      },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });

    return () => {
      active = false;
    };
  }, [link]);

  const downloadQrCode = () => {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = "convite-built-qrcode.png";
    anchor.click();
  };

  const isDark = variant === "dark";

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center"
      style={{
        background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,29,52,0.03)",
        borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,29,52,0.1)",
      }}
      data-testid="convite-qr-code"
    >
      <button
        type="button"
        onClick={() => qrDataUrl && setExpanded(true)}
        disabled={!qrDataUrl}
        className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-lg bg-white p-2 transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-gold disabled:cursor-wait"
        title="Ampliar QR Code"
        data-testid="btn-expandir-qr-convite"
      >
        {qrDataUrl ?(
          <img src={qrDataUrl} alt="QR Code do convite BUILT" className="h-full w-full" />
        ) : (
          <span className="text-center text-[10px] text-slate-500">Gerando QR Code...</span>
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className={`text-xs font-semibold ${isDark ?"text-white" : "text-foreground"}`}>
            QR Code do convite
          </p>
          <p className={`mt-1 text-[11px] leading-relaxed ${isDark ?"text-white/35" : "text-muted-foreground"}`}>
            Use para compartilhar o mesmo link em materiais, reuniões ou mensagens.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadQrCode}
          disabled={!qrDataUrl}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isDark
              ?"border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10"
              : "border-[#D7BB7D]/40 text-[#9B7A32] hover:bg-[#D7BB7D]/10"
          }`}
          data-testid="btn-baixar-qr-convite"
        >
          <Download className="h-3.5 w-3.5" />
          Baixar QR Code
        </button>
      </div>
      {expanded && qrDataUrl && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="QR Code do convite ampliado"
          onClick={() => setExpanded(false)}
          data-testid="modal-qr-convite-expandido"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#D7BB7D]/30 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#001D34]">QR Code do convite</p>
                <p className="mt-1 text-xs text-slate-500">Clique fora ou feche para voltar.</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#001D34]"
                aria-label="Fechar QR Code ampliado"
                data-testid="btn-fechar-qr-expandido"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto flex aspect-square w-full max-w-[340px] items-center justify-center rounded-xl bg-white p-3">
              <img src={qrDataUrl} alt="QR Code do convite BUILT ampliado" className="h-full w-full" />
            </div>
            <button
              type="button"
              onClick={downloadQrCode}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#D7BB7D]/50 px-3 py-2 text-sm font-medium text-[#9B7A32] transition-colors hover:bg-[#D7BB7D]/10"
            >
              <Download className="h-4 w-4" />
              Baixar QR Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
