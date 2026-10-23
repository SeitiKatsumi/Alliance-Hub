import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SearchableNameSelect, type SearchableNameOption } from "@/components/searchable-name-select";

export type BeneficiaryOption = {id: string; nome?: string | null; Nome_de_usuario?: string | null};

export function InitialBeneficiaryField({value, options, locked, disabled, allowExternal = true, onChange, onCreate, onDraftChange}: {
  value: string; options: BeneficiaryOption[]; locked: boolean; disabled?: boolean;
  allowExternal?: boolean;
  onChange: (id: string) => void; onCreate: (name: string) => Promise<BeneficiaryOption>;
  onDraftChange: (draft: boolean) => void;
}) {
  const [external, setExternal] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const beneficiaryOptions: SearchableNameOption[] = [
    { value: "", label: "Selecione", pinned: true },
    ...(value && !options.some((member) => member.id === value)
      ? [{ value, label: `Beneficiário selecionado (${value})`, pinned: true }]
      : []),
    ...options.map((member) => ({
      value: member.id,
      label: member.nome || member.Nome_de_usuario || member.id,
    })),
  ];
  const create = async () => {
    if (!name.trim() || pending || disabled || locked || !allowExternal) return;
    setPending(true); setError("");
    try {
      const created = await onCreate(name.trim());
      onChange(created.id); setExternal(false); setName(""); onDraftChange(false);
    } catch {
      setError("Não foi possível confirmar o cadastro. Confira os favorecidos antes de tentar novamente.");
    } finally { setPending(false); }
  };
  return <div className="min-w-0 space-y-2">
    <label className="block text-sm">Beneficiário<SearchableNameSelect
      value={value}
      options={beneficiaryOptions}
      disabled={disabled || locked || pending || external}
      ariaLabel="Beneficiário"
      searchPlaceholder="Buscar beneficiário por nome…"
      onValueChange={(nextValue) => { setError(""); onChange(nextValue); }}
    /></label>
    {!locked && allowExternal && <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <Checkbox checked={external} disabled={disabled || pending} onCheckedChange={checked => {
        const next = checked === true;
        setError(""); setExternal(next);
        if (!next) setName("");
        onDraftChange(next);
      }}/>
      <span>Não está na plataforma</span>
    </label>}
    {external && !locked && allowExternal && <div className="space-y-2 rounded border p-3">
      <label className="block text-sm">Nome do beneficiário externo<Input value={name} maxLength={200} disabled={disabled || pending} placeholder="Nome da pessoa ou razão social" onChange={e => setName(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">Cadastra somente um favorecido, sem login, convite ou participação na BIA.</p>
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled || pending || !name.trim()} onClick={create}>{pending ? "Adicionando…" : "Adicionar beneficiário"}</Button><Button type="button" variant="ghost" disabled={disabled || pending} onClick={() => {setExternal(false);setName("");setError("");onDraftChange(false);}}>Cancelar</Button></div>
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
