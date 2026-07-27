import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { AppUser } from "@/hooks/use-auth";
import { hasEmployeeModuleAccess } from "@/lib/company-access";

export type EnvironmentTarget = "vitrine" | "alliances" | "capital";

type AccessState = {
  canAccess: boolean;
  target: EnvironmentTarget;
  title: string;
  description: string;
  actionLabel: string;
};

function userRedes(user?: AppUser | null): string[] {
  return Array.isArray(user?.Outras_redes_as_quais_pertenco) ? user!.Outras_redes_as_quais_pertenco! : [];
}

export function environmentAccessFor(user: AppUser | null | undefined, target: EnvironmentTarget): AccessState {
  if (user?.company_employee && !hasEmployeeModuleAccess(user, target, "view")) {
    return {
      canAccess: false,
      target,
      title: "Acesso não liberado",
      description: "O responsável pela conta da empresa ainda não liberou este ambiente para você.",
      actionLabel: "Ver meu acesso",
    };
  }
  const role = user?.role || "";
  const redes = userRedes(user);
  const isAdmin = role === "admin" || role === "manager" || role === "superadmin";
  const isLicensedAlly = role === "aliado";
  const hasCapitalSeal = redes.includes("BUILT_CAPITAL_PARTNER");

  const isEmployee = user?.company_employee === true;
  const hasVitrineAccess = isEmployee || isAdmin || user?.na_vitrine === true;
  const hasCapitalAccess = isEmployee || isAdmin || user?.em_built_capital === true || role === "investidor" || hasCapitalSeal;
  const hasAlliancesAccess = isEmployee || isAdmin || isLicensedAlly || role === "membro" || user?.em_membros_built === true;

  if (target === "vitrine") {
    return {
      canAccess: hasVitrineAccess,
      target,
      title: "Acesso à BUILT Vitrine",
      description: "Para acessar a BUILT Vitrine, seu perfil precisa estar habilitado como Parceiro de Mercado.",
      actionLabel: "Atualizar perfil",
    };
  }

  if (target === "capital") {
    return {
      canAccess: hasCapitalAccess,
      target,
      title: "Acesso ao BUILT Capital",
      description: "Para acessar o BUILT Capital, seu perfil precisa estar habilitado como Parceiro de Capital.",
      actionLabel: "Atualizar perfil",
    };
  }

  return {
    canAccess: hasAlliancesAccess,
    target,
    title: "Torne-se membro BUILT Alliances",
    description: "A BUILT Alliances é restrita a membros da rede. Para acessar esse ambiente, conclua sua adesão como membro.",
    actionLabel: "Virar membro",
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
  const { toast } = useToast();
  const [isRequestingMembership, setIsRequestingMembership] = useState(false);

  async function handlePrimaryAction() {
    if (access?.target !== "alliances") {
      onOpenChange(false);
      navigate("/meu-perfil");
      return;
    }

    setIsRequestingMembership(true);
    try {
      const res = await fetch("/api/opa/solicitar-adesao", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar a adesão.");
      onOpenChange(false);
      if (data.alreadyMember) {
        navigate("/area-aliancas?tab=opas");
        return;
      }
      toast({
        title: "Pagamento de adesão gerado",
        description: "Vamos direcionar você para concluir a adesão.",
      });
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
      } else if (data.token) {
        navigate(`/pagamento/${data.token}`);
      } else if (data.link) {
        navigate(String(data.link).replace(/^https?:\/\/[^/]+/i, ""));
      }
    } catch (err: any) {
      toast({
        title: "Não foi possível iniciar a adesão",
        description: err?.message || "Verifique seu cadastro e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingMembership(false);
    }
  }

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
            onClick={handlePrimaryAction}
            disabled={isRequestingMembership}
          >
            {isRequestingMembership && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
