import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Settings, 
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Save,
  Edit2,
  X,
  Shield
} from "lucide-react";

interface Membro {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  empresa?: string;
  cargo?: string;
  especialidades?: string[];
  selos?: string[];
}

export default function AdminPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Membro>>({});

  const { data: membros = [], isLoading } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Membro> }) => {
      return apiRequest(`/api/directus/cadastro_geral/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify(data.updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/directus/cadastro_geral"] });
      toast({ title: "Sucesso", description: "Cadastro atualizado com sucesso!" });
      setEditingId(null);
      setEditForm({});
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar cadastro.", variant: "destructive" });
    },
  });

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  const startEdit = (membro: Membro) => {
    setEditingId(membro.id);
    setEditForm({
      nome: membro.nome,
      email: membro.email || "",
      telefone: membro.telefone || "",
      cidade: membro.cidade || "",
      estado: membro.estado || "",
      empresa: membro.empresa || "",
      cargo: membro.cargo || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({ id, updates: editForm });
  };

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
            <Settings className="w-6 h-6 text-brand-gold" />
            Administração
          </h1>
          <p className="text-muted-foreground">
            Gerencie seu cadastro e dados do membro
          </p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          <Shield className="w-3 h-3 mr-1" />
          {membros.length} membros cadastrados
        </Badge>
      </div>

      <div className="grid gap-4">
        {membros.map((membro) => (
          <Card key={membro.id} className="hover-elevate" data-testid={`admin-member-${membro.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-brand-navy text-white">
                      {getInitials(membro.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{membro.nome}</CardTitle>
                    {membro.cargo && (
                      <p className="text-sm text-muted-foreground">{membro.cargo}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {editingId === membro.id ? (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => saveEdit(membro.id)}
                        disabled={updateMutation.isPending}
                        data-testid={`button-save-${membro.id}`}
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Salvar
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={cancelEdit}
                        data-testid={`button-cancel-${membro.id}`}
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => startEdit(membro)}
                      data-testid={`button-edit-${membro.id}`}
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingId === membro.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome" className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Nome
                    </Label>
                    <Input
                      id="nome"
                      value={editForm.nome || ""}
                      onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      data-testid="input-nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      data-testid="input-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefone" className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Telefone
                    </Label>
                    <Input
                      id="telefone"
                      value={editForm.telefone || ""}
                      onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                      data-testid="input-telefone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa" className="flex items-center gap-1">
                      <Building className="w-3 h-3" /> Empresa
                    </Label>
                    <Input
                      id="empresa"
                      value={editForm.empresa || ""}
                      onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                      data-testid="input-empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cidade" className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Cidade
                    </Label>
                    <Input
                      id="cidade"
                      value={editForm.cidade || ""}
                      onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })}
                      data-testid="input-cidade"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Input
                      id="estado"
                      value={editForm.estado || ""}
                      onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })}
                      data-testid="input-estado"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {membro.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{membro.email}</span>
                    </div>
                  )}
                  {membro.telefone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{membro.telefone}</span>
                    </div>
                  )}
                  {membro.empresa && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building className="w-4 h-4" />
                      <span>{membro.empresa}</span>
                    </div>
                  )}
                  {(membro.cidade || membro.estado) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{[membro.cidade, membro.estado].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                </div>
              )}
              
              {(membro.especialidades?.length || membro.selos?.length) && !editingId && (
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                  {membro.especialidades?.map((esp, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {esp}
                    </Badge>
                  ))}
                  {membro.selos?.map((selo, i) => (
                    <Badge key={i} className="text-xs bg-brand-gold/10 text-brand-gold border-brand-gold/30">
                      {selo}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
