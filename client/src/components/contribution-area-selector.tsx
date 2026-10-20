import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  Check,
  CircleCheck,
  CircleDollarSign,
  Crown,
  FolderKanban,
  Lightbulb,
  Megaphone,
  ReceiptText,
  Scale,
  ShieldCheck,
  Tags,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import {
  getAllContributionAreas,
  normalizeContributionAreaValues,
  type ContributionAreaIconKey,
  type ContributionAreaTone,
} from "@shared/contribution-areas";
import { ContributionAreaInfo } from "@/components/contribution-area-info";

const ICONS: Record<ContributionAreaIconKey, LucideIcon> = {
  leadership: Crown,
  project: FolderKanban,
  legal: Scale,
  intelligence: Lightbulb,
  integrity: ShieldCheck,
  execution: CircleCheck,
  supply: Truck,
  construction: Building2,
  commercial: BriefcaseBusiness,
  sales: Tags,
  marketing: Megaphone,
  operations: Building2,
  relationship: Users,
  investment: ChartNoAxesCombined,
  credit: TrendingUp,
  accounting: ReceiptText,
  finance: CircleDollarSign,
};

const TONES: Record<ContributionAreaTone, { icon: string; background: string }> = {
  blue: { icon: "text-blue-600", background: "bg-blue-50" },
  emerald: { icon: "text-emerald-600", background: "bg-emerald-50" },
  purple: { icon: "text-purple-600", background: "bg-purple-50" },
  orange: { icon: "text-orange-600", background: "bg-orange-50" },
};

export function ContributionAreaSelector({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: string[]) => void;
}) {
  const selected = normalizeContributionAreaValues(value);
  const selectedSet = new Set(selected);

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {getAllContributionAreas().map((area) => {
          const active = selectedSet.has(area.value);
          const AreaIcon = ICONS[area.iconKey];
          const tone = TONES[area.tone];
          return (
            <div
              key={area.value}
              className={`flex min-w-0 items-center gap-1 rounded-md border pr-1 transition-colors ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
            >
              <button
                type="button"
                aria-pressed={active}
                data-testid={`onboarding-contribution-${area.iconKey}-${area.displayName}`}
                onClick={() => onChange(active
                  ? selected.filter((item) => item !== area.value)
                  : normalizeContributionAreaValues([...selected, area.value]))}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tone.background} ${tone.icon}`}>
                  <AreaIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 break-words leading-snug">{area.displayName}</span>
                {active && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
              </button>
              <ContributionAreaInfo label={area.displayName} />
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">Áreas selecionadas: {selected.length}</p>
      <p className="mt-1 text-xs text-muted-foreground">As áreas de liderança indicam como você pode contribuir; não atribuem cargos ou permissões em uma BIA.</p>
    </div>
  );
}
