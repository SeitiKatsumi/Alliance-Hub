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
  getPublicContributionAreas,
  normalizeContributionAreaValues,
  type ContributionAreaIconKey,
  type ContributionAreaTone,
} from "@shared/contribution-areas";

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
        {getPublicContributionAreas().map((area) => {
          const active = selectedSet.has(area.value);
          const AreaIcon = ICONS[area.iconKey];
          const tone = TONES[area.tone];
          return (
            <button
              type="button"
              key={area.value}
              aria-pressed={active}
              title={area.description}
              data-testid={`onboarding-contribution-${area.iconKey}-${area.displayName}`}
              onClick={() => onChange(active
                ? selected.filter((item) => item !== area.value)
                : normalizeContributionAreaValues([...selected, area.value]))}
              className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2 text-left text-sm font-semibold transition-colors ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md ${tone.background} ${tone.icon}`}>
                <AreaIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{area.displayName}</span>
              {active && <Check className="h-4 w-4 shrink-0 text-blue-600" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">Áreas selecionadas: {selected.length}</p>
    </div>
  );
}
