import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";

export const REDE_BADGES: Record<string, { img: string; label: string }> = {
  BUILT_PROUD_MEMBER: { img: "/built-proud-member.png", label: "BUILT Proud Member" },
  BUILT_FOUNDING_MEMBER: { img: "/built-founding-member.png", label: "BUILT Founding Member" },
  BUILT_CAPITAL_PARTNER: { img: "/built-capital-partner.png", label: "BUILT Capital Partner" },
  BNI: { img: "/bni-badge.png", label: "Membro BNI" },
};

export const REDE_ORDER = ["BUILT_PROUD_MEMBER", "BUILT_FOUNDING_MEMBER", "BUILT_CAPITAL_PARTNER", "BNI"];

export function getRedesBadges(redes?: string[] | null) {
  return REDE_ORDER.filter(rede => (redes || []).includes(rede) && REDE_BADGES[rede]);
}

export function RedeBadgeButton({
  rede,
  height = 48,
  maxWidth = 120,
  className = "",
  testId,
}: {
  rede: string;
  height?: number;
  maxWidth?: number;
  className?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const badge = REDE_BADGES[rede];
  if (!badge) return null;

  const displayHeight = rede === "BNI" ? Math.round(height * 0.72) : height;
  const displayMaxWidth = rede === "BNI" ? Math.round(maxWidth * 0.78) : maxWidth;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center justify-center rounded p-0.5 transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-brand-gold/50 ${className}`}
        title={`Ver selo: ${badge.label}`}
        data-testid={testId || `badge-rede-${rede.toLowerCase()}`}
      >
        <img
          src={badge.img}
          alt={badge.label}
          className="object-contain rounded"
          style={{ height: displayHeight, width: "auto", maxWidth: displayMaxWidth }}
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{badge.label}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center rounded-lg border bg-white p-6">
            <img
              src={badge.img}
              alt={badge.label}
              className="max-h-[70vh] max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
