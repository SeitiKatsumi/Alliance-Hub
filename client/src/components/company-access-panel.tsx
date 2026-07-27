import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  Clock3,
  Loader2,
  Mail,
  Pencil,
  Power,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  COMPANY_ACCESS_KEYS,
  COMPANY_ACCESS_LABELS,
  DEFAULT_COMPANY_ACCESS,
  normalizeCompanyAccess,
  type CompanyAccessKey,
  type CompanyAccessLevel,
  type CompanyAccessMatrix,
} from "@shared/company-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";

type CompanyEmployee = {
  id: string;
  nome: string;
  email: string;
  cargo?: string | null;
  status: "ativo" | "suspenso";
  ativo?: boolean;
  permissions: CompanyAccessMatrix;
  last_login_at?: string | null;
  created_at?: string | null;
};

type CompanyPlan = {
  id: string;
  plan_code: string;
  status: string;
  billing_mode: string;
  price_cents: number;
  currency: string;
  is_free: boolean;
  billing_required: boolean;
  can_manage_employees: boolean;
  activated_at?: string | null;
};

type EmployeeForm = {
  nome: string;
  email: string;
  cargo: string;
  password: string;
  permissions: CompanyAccessMatrix;
};

const EMPTY_FORM: EmployeeForm = {
  nome: "",
  email: "",
  cargo: "",
  password: "",
  permissions: { ...DEFAULT_COMPANY_ACCESS },
};

async function employeeRequest(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function enabledModules(employee: CompanyEmployee) {
  return COMPANY_ACCESS_KEYS.filter((key) => employee.permissions[key] !== "none");
}

export function CompanyAccessPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyEmployee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const { data: companyPlan, isLoading: isLoadingPlan } = useQuery<CompanyPlan>({
    queryKey: ["/api/empresa/plano"],
    queryFn: async () => {
      const response = await fetch("/api/empresa/plano", { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar a assinatura.");
      return response.json();
    },
    enabled: Boolean(user?.id && !user.company_employee),
  });

  const { data: employees = [], isLoading } = useQuery<CompanyEmployee[]>({
    queryKey: ["/api/empresa/funcionarios"],
    queryFn: async () => {
      const response = await fetch("/api/empresa/funcionarios", { credentials: "include" });
      if (!response.ok) throw new Error("Não foi possível carregar os acessos.");
      const items = await response.json();
      return (Array.isArray(items) ? items : []).map((item) => ({
        ...item,
        status: item.status === "suspenso" ? "suspenso" : "ativo",
        permissions: normalizeCompanyAccess(item.permissions),
      }));
    },
    enabled: Boolean(user?.id && !user.company_employee),
  });

  const activatePlanMutation = useMutation({
    mutationFn: () => employeeRequest("/api/empresa/plano/ativar", "POST"),
    onSuccess: (plan: CompanyPlan) => {
      queryClient.setQueryData(["/api/empresa/plano"], plan);
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/funcionarios"] });
      toast({
        title: "Plano Empresa ativado",
        description: "A assinatura gratuita está ativa e os acessos de funcionários foram liberados.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Não foi possível ativar", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        email: form.email,
        cargo: form.cargo,
        permissions: form.permissions,
        ...(form.password ? { password: form.password } : {}),
      };
      if (editing) return employeeRequest(`/api/empresa/funcionarios/${editing.id}`, "PATCH", payload);
      return employeeRequest("/api/empresa/funcionarios", "POST", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/funcionarios"] });
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: editing ? "Acesso atualizado" : "Funcionário adicionado" });
    },
    onError: (error: Error) => {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ employee, status }: { employee: CompanyEmployee; status: "ativo" | "suspenso" }) =>
      employeeRequest(`/api/empresa/funcionarios/${employee.id}`, "PATCH", { status }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/funcionarios"] });
      toast({ title: variables.status === "ativo" ? "Acesso reativado" : "Acesso suspenso" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível alterar o acesso", description: error.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (employee: CompanyEmployee) =>
      employeeRequest(`/api/empresa/funcionarios/${employee.id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/empresa/funcionarios"] });
      toast({ title: "Acesso removido" });
    },
    onError: (error: Error) => toast({ title: "Não foi possível remover", description: error.message, variant: "destructive" }),
  });

  const activeCount = useMemo(() => employees.filter((employee) => employee.status === "ativo").length, [employees]);
  const planIsActive = companyPlan?.status === "ativo" && companyPlan.can_manage_employees === true;
  const monthlyPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: companyPlan?.currency || "BRL",
  }).format(Number(companyPlan?.price_cents || 0) / 100);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, permissions: { ...DEFAULT_COMPANY_ACCESS } });
    setDialogOpen(true);
  }

  function openEdit(employee: CompanyEmployee) {
    setEditing(employee);
    setForm({
      nome: employee.nome || "",
      email: employee.email || "",
      cargo: employee.cargo || "",
      password: "",
      permissions: normalizeCompanyAccess(employee.permissions),
    });
    setDialogOpen(true);
  }

  function setPermission(key: CompanyAccessKey, level: CompanyAccessLevel) {
    setForm((current) => ({
      ...current,
      permissions: { ...current.permissions, [key]: level },
    }));
  }

  if (user?.company_employee) return null;

  return (
    <>
      <section className="profile-section overflow-hidden rounded-lg border border-slate-200 bg-white p-0 shadow-sm" data-testid="company-access-panel">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-[#001D34]">Acessos da empresa</h2>
              <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase text-blue-700">Plano Empresa</span>
              {companyPlan?.status === "ativo" && (
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                  Assinatura ativa
                </span>
              )}
              {!isLoadingPlan && companyPlan?.status !== "ativo" && (
                <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">
                  Assinatura disponível
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Crie logins individuais e escolha o que cada funcionário pode visualizar ou editar.
            </p>
            {companyPlan?.is_free && (
              <p className={`mt-1 text-xs font-medium ${planIsActive ? "text-emerald-700" : "text-blue-700"}`}>
                {planIsActive
                  ? "Gratuito por enquanto. Nenhuma cobrança será realizada nesta fase."
                  : "Ative gratuitamente para liberar os acessos de funcionários."}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={planIsActive ? openCreate : () => activatePlanMutation.mutate()}
            disabled={isLoadingPlan || activatePlanMutation.isPending}
            className="shrink-0 gap-2 bg-blue-600 text-white hover:bg-blue-700"
            data-testid={planIsActive ? "btn-add-company-employee" : "btn-activate-company-plan"}
          >
            {isLoadingPlan || activatePlanMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : planIsActive ? (
              <UserPlus className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
            {isLoadingPlan
              ? "Carregando plano..."
              : activatePlanMutation.isPending
                ? "Ativando..."
                : planIsActive
                  ? "Adicionar funcionário"
                  : "Ativar assinatura grátis"}
          </Button>
        </div>

        <div className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>{activeCount} {activeCount === 1 ? "acesso ativo" : "acessos ativos"}</span>
            </span>
            {companyPlan && (
              <span className="font-semibold text-[#001D34]">
                {companyPlan.is_free ? `${monthlyPrice}/mês nesta fase` : `${monthlyPrice}/mês`}
              </span>
            )}
          </div>

          {isLoadingPlan || isLoading ? (
            <div className="flex h-28 items-center justify-center text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Carregando Plano Empresa...
            </div>
          ) : !planIsActive ? (
            <div className="rounded-md border border-dashed border-blue-200 bg-blue-50/40 px-5 py-8 text-center">
              <Power className="mx-auto h-7 w-7 text-blue-500" />
              <p className="mt-2 text-sm font-semibold text-[#001D34]">Assinatura ainda não ativada</p>
              <p className="mt-1 text-xs text-slate-500">
                Ative o Plano Empresa gratuitamente para criar logins individuais e definir os acessos.
              </p>
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 px-5 py-8 text-center">
              <Users className="mx-auto h-7 w-7 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-[#001D34]">Nenhum funcionário cadastrado</p>
              <p className="mt-1 text-xs text-slate-500">Cada pessoa terá login próprio e acesso limitado pela sua configuração.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {employees.map((employee) => {
                const modules = enabledModules(employee);
                const suspended = employee.status === "suspenso";
                return (
                  <div key={employee.id} className={`rounded-md border p-3 ${suspended ? "border-slate-200 bg-slate-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-[#001D34]">{employee.nome}</p>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${suspended ? "bg-slate-200 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                            {suspended ? "Suspenso" : "Ativo"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{employee.email}</span>
                          {employee.cargo && <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{employee.cargo}</span>}
                          <span className="flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {employee.last_login_at ? `Último acesso ${new Date(employee.last_login_at).toLocaleDateString("pt-BR")}` : "Ainda não acessou"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {modules.length === 0 ? (
                            <span className="text-xs text-slate-400">Sem módulos liberados</span>
                          ) : modules.map((key) => (
                            <span key={key} className="rounded bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
                              {COMPANY_ACCESS_LABELS[key]} · {employee.permissions[key] === "edit" ? "edita" : "visualiza"}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" title="Editar acesso" onClick={() => openEdit(employee)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title={suspended ? "Reativar acesso" : "Suspender acesso"}
                          onClick={() => statusMutation.mutate({ employee, status: suspended ? "ativo" : "suspenso" })}
                        >
                          <Power className={`h-4 w-4 ${suspended ? "text-emerald-600" : "text-amber-600"}`} />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          title="Remover acesso"
                          onClick={() => {
                            if (window.confirm(`Remover o acesso de ${employee.nome}?`)) removeMutation.mutate(employee);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar acesso do funcionário" : "Adicionar funcionário"}</DialogTitle>
            <DialogDescription>
              O funcionário usará o próprio e-mail e senha. Ele nunca terá mais acesso do que a conta principal.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="employee-name">Nome completo</Label>
              <Input id="employee-name" value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-role">Cargo ou função</Label>
              <Input id="employee-role" value={form.cargo} onChange={(event) => setForm((current) => ({ ...current, cargo: event.target.value }))} placeholder="Ex.: Assistente financeiro" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-email">E-mail de acesso</Label>
              <Input id="employee-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employee-password">{editing ? "Nova senha (opcional)" : "Senha inicial"}</Label>
              <Input id="employee-password" type="password" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_82px_72px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
              <span>Módulo</span>
              <span className="text-center">Visualizar</span>
              <span className="text-center">Editar</span>
            </div>
            {COMPANY_ACCESS_KEYS.map((key) => {
              const level = form.permissions[key];
              return (
                <div key={key} className="grid min-h-11 grid-cols-[minmax(0,1fr)_82px_72px] items-center border-b border-slate-100 px-3 last:border-0">
                  <span className="text-sm font-medium text-[#001D34]">{COMPANY_ACCESS_LABELS[key]}</span>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={level === "view" || level === "edit"}
                      onCheckedChange={(checked) => setPermission(key, checked ? (level === "edit" ? "edit" : "view") : "none")}
                      aria-label={`Visualizar ${COMPANY_ACCESS_LABELS[key]}`}
                    />
                  </div>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={level === "edit"}
                      onCheckedChange={(checked) => setPermission(key, checked ? "edit" : level === "none" ? "none" : "view")}
                      aria-label={`Editar ${COMPANY_ACCESS_LABELS[key]}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={saveMutation.isPending || !form.nome.trim() || !form.email.trim() || (!editing && form.password.length < 6)}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar alterações" : "Criar acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
