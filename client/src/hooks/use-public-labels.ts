import { useQuery } from "@tanstack/react-query";
import { PUBLIC_LABELS, type PublicLabelKey } from "@shared/public-labels";

type PublicLabelItem = { code: PublicLabelKey; display_name: string };

export function usePublicLabels() {
  const { data = [] } = useQuery<PublicLabelItem[]>({ queryKey: ["/api/taxonomy/public-labels"] });
  const overrides = new Map(data.map((item) => [item.code, item.display_name]));
  return (code: PublicLabelKey) => overrides.get(code) || PUBLIC_LABELS[code];
}
