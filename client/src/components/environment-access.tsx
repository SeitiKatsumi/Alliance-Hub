import { ReactNode } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppUser } from "@/hooks/use-auth";

export type EnvironmentTarget = "vitrine" | "alliances" | "capital";

type AccessState = {
  canAccess: boolean;
  title: string;
  description: string;
  actionLabel: string;
};

function userRedes(user?: AppUser | null): string[] {
  return Array.isArray(user?.Outras_redes_as_quais_pertenco) ? user!.Outras_redes_as_quais_pertenco! : [];
}

export function environmentAccessFor(user: AppUser | null | undefined, target: EnvironmentTarget): AccessState {
  const role = user?.role || "";
  const redes = userRedes(user);
  const isAdmin = role === "admin" || role === "manager";
  const hasCapitalSeal = redes.includes("BUILT_CAPITAL_PARTNER");
  const hasMemberSeal =
    redes.includes("BUILT_PROUD_MEMBER") ||
    redes.includes("BUILT_FOUNDING_MEMBER") ||
    redes.includes("BUILT_ALLIANCE_PARTNER");

  const hasVitrineAccess = isAdmin || user?.na_vitrine === true;
  const hasCapitalAccess = isAdmin || user?.em_built_capital === true || role === "investidor" || hasCapitalSeal;
  const hasAlliancesAccess = isAdmin || user?.em_membros_built === true || role === "membro" || hasMemberSeal;

  if (target === "vitrine") {
    return {
      canAccess: hasVitrineAccess,
      title: "Acesso à BUILT Vitrine",
      description: "Para acessar a BUILT Vitrine, seu perfil precisa estar habilitado como parceiro de mercado/vitrine.",
      actionLabel: "Atualizar perfil",
    };
  }

  if (target === "capital") {
    return {
      canAccess: hasCapitalAccess,
      title: "Acesso ao BUILT Capital",
      description: "Para acessar o BUILT Capital, seu perfil precisa estar habilitado como parceiro de capital ou investidor.",
      actionLabel: "Atualizar perfil",
    };
  }

  return {
    canAccess: hasAlliancesAccess,
    title: "Torne-se membro BUILT",
    description: "A BUILT Alliances é restrita a membros da rede. Para acessar esse ambiente, solicite ou conclua sua adesão como membro.",
    actionLabel: "Ver meu perfil",
  };
}

export function EnvironmentAccessDialog({
  access,
  open,
  onOpenChange,
}: {
  access: AccessState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, navigate] = useLocation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{access?.title || "Acesso ao ambiente"}</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {access?.description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => {
              onOpenChange(false);
              navigate("/meu-perfil");
            }}
          >
            {access?.actionLabel || "Ver perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EnvironmentGateLink({
  children,
  className,
  href,
  target,
  user,
  setBlockedAccess,
  onAllowed,
}: {
  children: ReactNode;
  className?: string;
  href: string;
  target: EnvironmentTarget;
  user: AppUser | null | undefined;
  setBlockedAccess: (access: AccessState) => void;
  onAllowed?: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const access = environmentAccessFor(user, target);
        if (!access.canAccess) {
          setBlockedAccess(access);
          return;
        }
        onAllowed?.();
        navigate(href);
      }}
    >
      {children}
    </button>
  );
}
