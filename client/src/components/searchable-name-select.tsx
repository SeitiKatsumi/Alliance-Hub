import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SearchableNameOption = {
  value: string;
  label: string;
  disabled?: boolean;
  pinned?: boolean;
  searchText?: string;
};

export function normalizeSearchableName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function sortSearchableNameOptions(options: SearchableNameOption[]) {
  const uniqueOptions = Array.from(new Map(options.map((option) => [option.value, {
    ...option,
    label: option.label.trim() || option.label,
    searchText: option.searchText?.trim(),
  }])).values());
  return uniqueOptions.sort((left, right) => {
    if (!!left.pinned !== !!right.pinned) return left.pinned ? -1 : 1;
    if (left.pinned && right.pinned) return 0;
    return left.label.localeCompare(right.label, "pt-BR", { sensitivity: "base", numeric: true });
  });
}

export function searchableNameFilter(_value: string, search: string, keywords?: string[]) {
  const term = normalizeSearchableName(search);
  if (!term) return 1;
  return normalizeSearchableName((keywords || []).join(" ")).includes(term) ? 1 : 0;
}

export function SearchableNameSelect({
  value,
  options,
  onValueChange,
  placeholder = "Selecione",
  searchPlaceholder = "Buscar por nome…",
  emptyMessage = "Nenhum nome encontrado.",
  disabled = false,
  ariaLabel,
  className,
  testId,
}: {
  value: string;
  options: SearchableNameOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const sortedOptions = useMemo(() => sortSearchableNameOptions(options), [options]);
  const selected = sortedOptions.find((option) => option.value === value);

  return <Popover open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
    <PopoverTrigger asChild>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open && !disabled}
        disabled={disabled}
        data-testid={testId}
        className={cn("h-10 w-full min-w-0 justify-between px-3 text-left font-normal", className)}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
      <Command filter={searchableNameFilter}>
        <CommandInput aria-label={`Pesquisar em ${ariaLabel}`} placeholder={searchPlaceholder} />
        <CommandList className="max-h-72">
          <CommandEmpty>{emptyMessage}</CommandEmpty>
          <CommandGroup>
            {sortedOptions.map((option) => <CommandItem
              key={`${option.value}:${option.label}`}
              value={`${option.label} ${option.value}`}
              keywords={[option.label, option.searchText || ""]}
              disabled={option.disabled}
              onSelect={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
            >
              <Check className={cn("h-4 w-4", value === option.value ? "opacity-100" : "opacity-0")} aria-hidden="true" />
              <span className="min-w-0 break-words">{option.label}</span>
            </CommandItem>)}
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
