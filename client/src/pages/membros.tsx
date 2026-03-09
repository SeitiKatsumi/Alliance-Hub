import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AuraScore } from "@/components/aura-score";
import { 
  Users,
  UserCheck,
  TrendingUp,
  History,
  Mail,
  Phone,
  MapPin,
  Building,
  Sparkles
} from "lucide-react";

interface Membro {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cidade?: string;
  estado?: string;
  empresa?: string;
  cargo?: string;
}

export default function MembrosPage() {
  const { data: membros = [], isLoading } = useQuery<Membro[]>({
    queryKey: ["/api/membros"],
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const getAuraScore = (index: number) => 65 + ((index * 17) % 30);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-gold" />
            Membros
          </h1>
          <p className="text-muted-foreground">
            Diretório de membros do ecossistema Built Alliances
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          <Sparkles className="w-3 h-3 mr-1" />
          {membros.length} membros ativos
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {membros.map((membro, index) => (
          <Card 
            key={membro.id} 
            className="hover-elevate"
            data-testid={`card-membro-${membro.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarFallback className="bg-brand-navy text-white text-lg">
                    {getInitials(membro.nome)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg truncate">{membro.nome}</CardTitle>
                  {membro.cargo && (
                    <p className="text-sm text-muted-foreground truncate">
                      {membro.cargo}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <AuraScore score={getAuraScore(index)} size="sm" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                {membro.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{membro.email}</span>
                  </div>
                )}
                {(membro.telefone || membro.whatsapp) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{membro.whatsapp || membro.telefone}</span>
                  </div>
                )}
                {membro.empresa && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Building className="w-4 h-4 shrink-0" />
                    <span className="truncate">{membro.empresa}</span>
                  </div>
                )}
                {(membro.cidade || membro.estado) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span>{[membro.cidade, membro.estado].filter(Boolean).join(", ")}</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-wrap gap-2 pt-3 border-t">
                <Button size="sm" variant="default" data-testid={`button-avaliar-${membro.id}`}>
                  <UserCheck className="w-3 h-3 mr-1" />
                  Avaliar
                </Button>
                <Button size="sm" variant="outline" data-testid={`button-analisar-${membro.id}`}>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Analisar Aura
                </Button>
                <Button size="sm" variant="outline" data-testid={`button-historico-${membro.id}`}>
                  <History className="w-3 h-3 mr-1" />
                  Histórico
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
