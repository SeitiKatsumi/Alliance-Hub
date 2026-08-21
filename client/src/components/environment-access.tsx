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
import { hasEmployeeModuleAccess } from "@/lib/company-access";
import {
  canAccessBuiltEnvironment,
  type BuiltEnvironmentTarget,
} from "@shared/environment-access";

export type EnvironmentTarget = BuiltEnvironmentTarget;

type AccessState = {
  canAccess: boolean;
  target: EnvironmentTarget;
  title: string;
  description: string;
  actionLabel: string;
};

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
  const canAccess = canAccessBuiltEnvironment(user, target);

  if (target === "vitrine") {
    return {
      canAccess,
      target,
      title: "Área de Vitrine",
      description: "Todos os usuários podem consultar profissionais, fornecedores, demandas e OBAs. Somente perfis profissionais podem optar por aparecer na Vitrine.",
      actionLabel: "Abrir Vitrine",
    };
  }

  if (target === "capital") {
    return {
      canAccess,
      target,
      title: "Acesso ao BUILT Capital",
      description: "Para acessar o BUILT Capital, seu perfil precisa estar habilitado como Parceiro de Capital.",
      actionLabel: "Atualizar perfil",
    };
  }

  return {
    canAccess,
    target,
    title: "Área de Alianças",
    description: "Este ambiente é exclusivo para quem desenvolve ou participa de uma aliança. Consulte seus convites e chamadas na Agenda.",
    actionLabel: "Ver Agenda",
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

  async function handlePrimaryAction() {
    if (access?.target === "alliances") {
      onOpenChange(false);
      navigate("/agenda-alertas?view=alertas");
      return;
    }

    if (access) {
      onOpenChange(false);
      navigate("/meu-perfil");
      return;
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
