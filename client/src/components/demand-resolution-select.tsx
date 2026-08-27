import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DemandResolutionMode = "DIRECT_HIRE" | "NETWORK_DEMAND" | "INTERNAL_BIA" | "OBA";

export const DEMAND_RESOLUTION_LABELS: Record<DemandResolutionMode, string> = {
  DIRECT_HIRE: "Contratação direta",
  NETWORK_DEMAND: "Receber propostas da rede",
  INTERNAL_BIA: "Resolver dentro da BIA",
  OBA: "Formar uma nova aliança (OBA)",
};

export function DemandResolutionSelect({
  value,
  onChange,
  hasBia = false,
}: {
  value: DemandResolutionMode;
  onChange: (value: DemandResolutionMode) => void;
  hasBia?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>Como deseja resolver?</Label>
      <Select value={value} onValueChange={(next) => onChange(next as DemandResolutionMode)}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="DIRECT_HIRE">{DEMAND_RESOLUTION_LABELS.DIRECT_HIRE}</SelectItem>
          <SelectItem value="NETWORK_DEMAND">{DEMAND_RESOLUTION_LABELS.NETWORK_DEMAND}</SelectItem>
          {hasBia && <SelectItem value="INTERNAL_BIA">{DEMAND_RESOLUTION_LABELS.INTERNAL_BIA}</SelectItem>}
          {hasBia && <SelectItem value="OBA">{DEMAND_RESOLUTION_LABELS.OBA}</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}
