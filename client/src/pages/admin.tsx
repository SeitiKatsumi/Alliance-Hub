import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Settings,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Building,
  Save,
  Edit2,
  X,
  Shield,
  Plus,
  Trash2,
  Users,
  Eye,
  EyeOff,
  Lock,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  Link2,
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
  responsavel_cargo?: string;
  especialidades?: string[];
  selos?: string[];
}

interface AppUser {
  id: string;
  username: string;
  nome: string;
  email: string | null;
  membro_directus_id: string | null;
  role: string;
  permissions: Record<string, string>;
  ativo: boolean;
  created_at: string;
}

const MODULE_LABELS: Record<string, string> = {
  oportunidades: "Oportunidades",
  bias: "BIAS - Alianças",
  calculadora: "Calculadora DM",
  fluxo_caixa: "Fluxo de Caixa",
  membros: "Membros",
  aura: "AURA Built",
  painel: "Meu Painel",
  admin: "Administração",
};

const MODULE_KEYS = Object.keys(MODULE_LABELS);

const PERMISSION_LABELS: Record<string, { label: string; color: string }> = {
  none: { label: "Sem Acesso", color: "text-red-500" },
  view: { label: "Visualizar", color: "text-blue-500" },
  edit: { label: "Editar", color: "text-green-500" },
};

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  admin: { label: "Administrador", icon: ShieldCheck, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
  manager: { label: "Gerente", icon: ShieldAlert, color: "text-blue-500 bg-blue-500/10 border-blue-500/30" },
  user: { label: "Usuário", icon: Shield, color: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
};

const DEFAULT_PERMISSIONS: Record<string, string> = {
  oportunidades: "view",
  bias: "view",
  calculadora: "none",
  fluxo_caixa: "none",
  membros: "view",
  aura: "view",
  painel: "view",
  admin: "none",
};

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("usuarios");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Membro>>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("user");
  const [formMembro, setFormMembro] = useState("");
  const [formAtivo, setFormAtivo] = useState(true);
  const [formPermissions, setFormPermissions] = useState<Record<string, string>>({ ...DEFAULT_PERMISSIONS });

  const { data: membros = [], isLoading: loadingMembros } = useQuery<Membro[]>({
    queryKey: ["/api/directus/cadastro_geral"],
  });

  const { data: appUsers = [], isLoading: loadingUsers } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário criado com sucesso" });
      resetUserForm();
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      return apiRequest("PATCH", `/api/users/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário atualizado com sucesso" });
      setEditingUserId(null);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário excluído" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<Membro> }) => {
      return apiRequest("PATCH", `/api/directus/cadastro_geral/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/directus/cadastro_geral"] });
      toast({ title: "Cadastro atualizado com sucesso" });
      setEditingId(null);
      setEditForm({});
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cadastro", variant: "destructive" });
    },
  });

  function resetUserForm() {
    setFormUsername("");
    setFormPassword("");
    setFormNome("");
    setFormEmail("");
    setFormRole("user");
    setFormMembro("");
    setFormAtivo(true);
    setFormPermissions({ ...DEFAULT_PERMISSIONS });
    setShowPassword(false);
  }

  function openCreateDialog() {
    resetUserForm();
    setEditingUserId(null);
    setShowCreateDialog(true);
  }

  function openEditUser(user: AppUser) {
    setFormUsername(user.username);
    setFormPassword("");
    setFormNome(user.nome);
    setFormEmail(user.email || "");
    setFormRole(user.role);
    setFormMembro(user.membro_directus_id || "");
    setFormAtivo(user.ativo);
    setFormPermissions({ ...DEFAULT_PERMISSIONS, ...user.permissions });
    setEditingUserId(user.id);
    setShowCreateDialog(true);
    setShowPassword(false);
  }

  function handleSaveUser() {
    if (!formUsername.trim() || formUsername.length < 3) {
      toast({ title: "Usuário deve ter pelo menos 3 caracteres", variant: "destructive" });
      return;
    }
    if (!formNome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!editingUserId && (!formPassword || formPassword.length < 4)) {
      toast({ title: "Senha deve ter pelo menos 4 caracteres", variant: "destructive" });
      return;
    }

    const data: Record<string, unknown> = {
      username: formUsername,
      nome: formNome,
      email: formEmail || "",
      role: formRole,
      membro_directus_id: (formMembro && formMembro !== "none_selected") ? formMembro : "",
      ativo: formAtivo,
      permissions: formPermissions,
    };
    if (formPassword) data.password = formPassword;

    if (editingUserId) {
      updateUserMutation.mutate({ id: editingUserId, data });
    } else {
      data.password = formPassword;
      createUserMutation.mutate(data);
    }
  }

  function setPermission(module: string, level: string) {
    setFormPermissions((prev) => ({ ...prev, [module]: level }));
  }

  function setAllPermissions(level: string) {
    const newPerms: Record<string, string> = {};
    MODULE_KEYS.forEach((k) => { newPerms[k] = level; });
    setFormPermissions(newPerms);
  }

  const membroMap = useMemo(() => {
    const map: Record<string, string> = {};
    membros.forEach((m) => { map[m.id] = m.nome; });
    return map;
  }, [membros]);

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
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

  if (loadingMembros || loadingUsers) {
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
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-admin-title">
            <Settings className="w-6 h-6 text-brand-gold" />
            Administração
          </h1>
          <p className="text-muted-foreground">Gerencie usuários, permissões e cadastros</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="usuarios" className="flex items-center gap-2" data-testid="tab-usuarios">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="membros" className="flex items-center gap-2" data-testid="tab-membros">
            <UserIcon className="w-4 h-4" />
            Membros
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1">
                <Users className="w-3 h-3 mr-1" />
                {appUsers.length} usuários
              </Badge>
            </div>
            <Button onClick={openCreateDialog} data-testid="button-novo-usuario">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </div>

          {appUsers.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium text-muted-foreground">Nenhum usuário cadastrado</h3>
                <p className="text-sm text-muted-foreground/70 mt-2">Crie o primeiro usuário para gerenciar o acesso à plataforma</p>
                <Button className="mt-4" onClick={openCreateDialog}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar Primeiro Usuário
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {appUsers.map((user) => {
                const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.user;
                const RoleIcon = roleConfig.icon;
                const linkedMembro = user.membro_directus_id ? membroMap[user.membro_directus_id] : null;

                return (
                  <Card key={user.id} className="hover-elevate" data-testid={`card-user-${user.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="w-10 h-10 shrink-0">
                            <AvatarFallback className={`${user.ativo ? "bg-brand-navy text-white" : "bg-muted text-muted-foreground"}`}>
                              {getInitials(user.nome)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold truncate" data-testid={`text-user-nome-${user.id}`}>{user.nome}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleConfig.color}`}>
                                <RoleIcon className="w-3 h-3 mr-0.5" />
                                {roleConfig.label}
                              </Badge>
                              {!user.ativo && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-500 border-red-500/30 bg-red-500/10">
                                  <XCircle className="w-3 h-3 mr-0.5" />
                                  Inativo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <KeyRound className="w-3 h-3" />
                                {user.username}
                              </span>
                              {user.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {user.email}
                                </span>
                              )}
                              {linkedMembro && (
                                <span className="flex items-center gap-1">
                                  <Link2 className="w-3 h-3" />
                                  {linkedMembro}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex gap-1 flex-wrap">
                            {MODULE_KEYS.map((mod) => {
                              const perm = user.permissions?.[mod] || "none";
                              const dotColor = perm === "edit" ? "bg-green-500" : perm === "view" ? "bg-blue-500" : "bg-red-500/40";
                              return (
                                <div
                                  key={mod}
                                  className={`w-2 h-2 rounded-full ${dotColor}`}
                                  title={`${MODULE_LABELS[mod]}: ${PERMISSION_LABELS[perm]?.label || perm}`}
                                />
                              );
                            })}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditUser(user)}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit2 className="w-3 h-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => {
                              if (confirm("Tem certeza que deseja excluir este usuário?")) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="membros" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
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
                        {(membro.cargo || membro.responsavel_cargo) && (
                          <p className="text-sm text-muted-foreground">{membro.cargo || membro.responsavel_cargo}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingId === membro.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateMemberMutation.mutate({ id: membro.id, updates: editForm })}
                            disabled={updateMemberMutation.isPending}
                            data-testid={`button-save-${membro.id}`}
                          >
                            <Save className="w-3 h-3 mr-1" />
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingId(null); setEditForm({}); }}
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
                        <Label className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> Nome</Label>
                        <Input value={editForm.nome || ""} onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })} data-testid="input-nome" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</Label>
                        <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="input-email" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</Label>
                        <Input value={editForm.telefone || ""} onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })} data-testid="input-telefone" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><Building className="w-3 h-3" /> Empresa</Label>
                        <Input value={editForm.empresa || ""} onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })} data-testid="input-empresa" />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Cidade</Label>
                        <Input value={editForm.cidade || ""} onChange={(e) => setEditForm({ ...editForm, cidade: e.target.value })} data-testid="input-cidade" />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado</Label>
                        <Input value={editForm.estado || ""} onChange={(e) => setEditForm({ ...editForm, estado: e.target.value })} data-testid="input-estado" />
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
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingUserId ? (
                <>
                  <Edit2 className="w-5 h-5 text-brand-gold" />
                  Editar Usuário
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-brand-gold" />
                  Novo Usuário
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <UserIcon className="w-3 h-3" /> Nome Completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  placeholder="Nome do usuário"
                  data-testid="input-user-nome"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </Label>
                <Input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  data-testid="input-user-email"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Usuário (login) <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="nome.usuario"
                  data-testid="input-user-username"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Senha {!editingUserId && <span className="text-red-500">*</span>}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUserId ? "Deixe em branco para manter" : "Mínimo 4 caracteres"}
                    data-testid="input-user-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Perfil
                </Label>
                <Select value={formRole} onValueChange={(v) => {
                  setFormRole(v);
                  if (v === "admin") {
                    const allEdit: Record<string, string> = {};
                    MODULE_KEYS.forEach((k) => { allEdit[k] = "edit"; });
                    setFormPermissions(allEdit);
                  }
                }}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="user">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Link2 className="w-3 h-3" /> Vincular Membro (Directus)
                </Label>
                <Select value={formMembro} onValueChange={setFormMembro}>
                  <SelectTrigger data-testid="select-user-membro">
                    <SelectValue placeholder="Nenhum vínculo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none_selected">Nenhum vínculo</SelectItem>
                    {membros.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={formAtivo}
                onCheckedChange={setFormAtivo}
                data-testid="switch-user-ativo"
              />
              <Label className="flex items-center gap-1.5">
                {formAtivo ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                {formAtivo ? "Usuário Ativo" : "Usuário Inativo"}
              </Label>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-gold" />
                  Permissões por Módulo
                </Label>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAllPermissions("edit")} data-testid="button-all-edit">
                    Todos: Editar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAllPermissions("view")} data-testid="button-all-view">
                    Todos: Visualizar
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAllPermissions("none")} data-testid="button-all-none">
                    Todos: Sem Acesso
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {MODULE_KEYS.map((mod) => (
                  <div key={mod} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border" data-testid={`perm-row-${mod}`}>
                    <span className="text-sm font-medium">{MODULE_LABELS[mod]}</span>
                    <div className="flex gap-1">
                      {(["none", "view", "edit"] as const).map((level) => {
                        const isActive = formPermissions[mod] === level;
                        const config = PERMISSION_LABELS[level];
                        return (
                          <Button
                            key={level}
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            className={`h-7 text-xs min-w-[90px] ${isActive ? "" : "opacity-60"}`}
                            onClick={() => setPermission(mod, level)}
                            data-testid={`perm-${mod}-${level}`}
                          >
                            {config.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-user">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleSaveUser}
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
              data-testid="button-save-user"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingUserId ? "Salvar Alterações" : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
