import { Target } from "lucide-react";

export default function OportunidadesPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Target className="w-8 h-8 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-semibold text-foreground">OPAs</h1>
      <p className="text-muted-foreground max-w-sm">
        Este módulo está sendo preparado. Em breve você poderá gerenciar suas OPAs aqui.
      </p>
    </div>
  );
}
