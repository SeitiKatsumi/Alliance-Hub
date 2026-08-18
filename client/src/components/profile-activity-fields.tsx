import { useMemo, useState } from "react";
import { Check, ChevronDown, Languages, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RAMOS_SEGMENTOS,
  formatRamosValue,
  formatSegmentosValue,
  getSegmentosForRamos,
  parseRamosValue,
  parseSegmentosValue,
} from "@/lib/ramos-segmentos";
import {
  PROFILE_AREA_SCOPE_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  normalizeProfileLanguages,
} from "@shared/profile-taxonomy";

export type ProfileActivityValue = {
  ramo_atuacao?: string | null;
  segmento?: string | null;
  area_atuacao?: string | null;
  especialidade_livre?: string | null;
  idiomas?: string[] | null;
};

function searchKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function MultiSelectField({
  label,
  itemLabel,
  itemLabelPlural,
  placeholder,
  disabledPlaceholder,
  searchPlaceholder,
  items,
  selected,
  disabled,
  onToggle,
  onClear,
  testId,
}: {
  label: string;
  itemLabel: string;
  itemLabelPlural: string;
  placeholder: string;
  disabledPlaceholder?: string;
  searchPlaceholder: string;
  items: Array<{ key: string; label: string }>;
  selected: string[];
  disabled?: boolean;
  onToggle: (value: string) => void;
  onClear: () => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const query = searchKey(search.trim());
    return query ? items.filter((item) => searchKey(item.label).includes(query)) : items;
  }, [items, search]);

  return (
    <div className="space-y-2" data-testid={testId}>
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-auto min-h-10 w-full justify-between bg-white px-3 py-2 text-left font-normal text-slate-700"
          >
            <span className="min-w-0 flex-1 truncate">
              {disabled
                ? disabledPlaceholder
                : selected.length
                  ? `${selected.length} ${selected.length > 1 ? itemLabelPlural : itemLabel} selecionado${selected.length > 1 ? "s" : ""}`
                  : placeholder}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] border-slate-200 bg-white p-0 text-slate-900">
          <div className="border-b border-slate-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 bg-white pl-9 text-sm"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
              <span>{selected.length} de {items.length} selecionado{selected.length !== 1 ? "s" : ""}</span>
              {selected.length > 0 && <button type="button" onClick={onClear} className="font-medium text-blue-600 hover:text-blue-700">Limpar</button>}
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {filtered.length ? filtered.map((item) => {
              const checked = selected.includes(item.label);
              return (
                <label key={item.key} className={`flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 text-sm ${checked ? "bg-blue-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"}`}>
                  <Checkbox checked={checked} onCheckedChange={() => onToggle(item.label)} className="mt-0.5" />
                  <span className="leading-5">{item.label}</span>
                </label>
              );
            }) : <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma opção encontrada.</p>}
          </div>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((item) => (
            <span key={item} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
              <span className="truncate">{item}</span>
              <button type="button" onClick={() => onToggle(item)} className="rounded-full p-0.5 text-blue-500 hover:bg-blue-100" aria-label={`Remover ${item}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfileActivityFields({
  value,
  onChange,
}: {
  value: ProfileActivityValue;
  onChange: (patch: Partial<ProfileActivityValue>) => void;
}) {
  const [languageInput, setLanguageInput] = useState("");
  const selectedRamos = parseRamosValue(value.ramo_atuacao);
  const selectedSegmentos = parseSegmentosValue(value.segmento);
  const availableSegmentos = getSegmentosForRamos(selectedRamos);
  const idiomas = normalizeProfileLanguages(value.idiomas);

  const toggleRamo = (ramo: string) => {
    const nextRamos = selectedRamos.includes(ramo)
      ? selectedRamos.filter((item) => item !== ramo)
      : [...selectedRamos, ramo];
    const allowedSegmentos = new Set(getSegmentosForRamos(nextRamos).map((item) => item.nome));
    onChange({
      ramo_atuacao: formatRamosValue(nextRamos),
      segmento: formatSegmentosValue(selectedSegmentos.filter((item) => allowedSegmentos.has(item))),
    });
  };

  const toggleSegmento = (segmento: string) => {
    onChange({
      segmento: formatSegmentosValue(selectedSegmentos.includes(segmento)
        ? selectedSegmentos.filter((item) => item !== segmento)
        : [...selectedSegmentos, segmento]),
    });
  };

  const addLanguage = () => {
    const language = languageInput.trim();
    if (!language) return;
    onChange({ idiomas: normalizeProfileLanguages([...idiomas, language]) });
    setLanguageInput("");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MultiSelectField
        label="Ramo de atuação"
        itemLabel="ramo"
        itemLabelPlural="ramos"
        placeholder="Buscar e selecionar ramos"
        searchPlaceholder="Pesquisar ramo..."
        items={RAMOS_SEGMENTOS.map((item) => ({ key: item.codigo, label: item.nome }))}
        selected={selectedRamos}
        onToggle={toggleRamo}
        onClear={() => onChange({ ramo_atuacao: null, segmento: null })}
        testId="onboarding-ramo-atuacao"
      />
      <MultiSelectField
        label="Segmento"
        itemLabel="segmento"
        itemLabelPlural="segmentos"
        placeholder="Buscar e selecionar segmentos"
        disabledPlaceholder="Selecione ao menos um ramo primeiro"
        searchPlaceholder="Pesquisar segmento..."
        items={availableSegmentos.map((item) => ({ key: item.codigo, label: item.nome }))}
        selected={selectedSegmentos}
        disabled={selectedRamos.length === 0}
        onToggle={toggleSegmento}
        onClear={() => onChange({ segmento: null })}
        testId="onboarding-segmento"
      />
      <div className="space-y-2">
        <Label>Área de atuação</Label>
        <Select value={value.area_atuacao || ""} onValueChange={(area_atuacao) => onChange({ area_atuacao })}>
          <SelectTrigger data-testid="onboarding-area-atuacao"><SelectValue placeholder="Selecione a área" /></SelectTrigger>
          <SelectContent>{PROFILE_AREA_SCOPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Especialidade (descreva seus produtos e serviços)</Label>
        <Input
          value={value.especialidade_livre || ""}
          onChange={(event) => onChange({ especialidade_livre: event.target.value })}
          placeholder="Ex.: Gestão de contratos, Retrofit, BIM..."
          data-testid="onboarding-especialidade-livre"
        />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label className="flex items-center gap-1.5"><Languages className="h-4 w-4" />Idiomas falados</Label>
        {idiomas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {idiomas.map((idioma) => (
              <span key={idioma} className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                {idioma}
                <button type="button" onClick={() => onChange({ idiomas: idiomas.filter((item) => item !== idioma) })} aria-label={`Remover ${idioma}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={languageInput}
            onChange={(event) => setLanguageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== ",") return;
              event.preventDefault();
              addLanguage();
            }}
            placeholder="Buscar ou digitar idioma..."
            list="onboarding-profile-languages"
            data-testid="onboarding-idiomas"
          />
          <Button type="button" variant="outline" onClick={addLanguage} className="shrink-0"><Check className="mr-1 h-4 w-4" />Adicionar</Button>
        </div>
        <datalist id="onboarding-profile-languages">{PROFILE_LANGUAGE_OPTIONS.map((option) => <option key={option} value={option} />)}</datalist>
      </div>
    </div>
  );
}
