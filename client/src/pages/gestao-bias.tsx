import { Briefcase } from "lucide-react";

export default function GestaoBiasPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-gestao-bias-title">
          Gestão de BIAs
        </h1>
        <p className="text-sm text-muted-foreground">
          Módulo reservado para a gestão operacional das BIAs.
        </p>
      </div>

      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
        <div className="text-center">
          <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">Nenhum conteúdo configurado por enquanto.</p>
        </div>
      </div>
    </div>
  );
}
