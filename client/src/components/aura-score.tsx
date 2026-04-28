import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

interface AuraScoreProps {
  score: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

function getFaixaColor(score: number | null): string {
  if (score === null) return "#4B5563";
  if (score >= 90) return "#D7BB7D";
  if (score >= 70) return "#3B82F6";
  if (score >= 50) return "#22C55E";
  return "#EF4444";
}

function getFaixaNome(score: number | null): string {
  if (score === null) return "Sem dados";
  if (score >= 90) return "Aura Suprema";
  if (score >= 70) return "Aura Forte";
  if (score >= 50) return "Aura Confiável";
  return "Em Evolução";
}

export function AuraScore({ score, size = "md", showLabel = true, className }: AuraScoreProps) {
  const sizeMap = { sm: "w-16 h-16", md: "w-24 h-24", lg: "w-32 h-32" };
  const textMap = { sm: "text-sm", md: "text-2xl", lg: "text-4xl" };

  const circumference = 2 * Math.PI * 45;
  const pct = score !== null ? Math.min(score, 100) / 100 : 0;
  const strokeDashoffset = circumference - pct * circumference;
  const color = getFaixaColor(score);

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className={cn("relative", sizeMap[size])}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <filter id="aura-glow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {score !== null && (
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              filter="url(#aura-glow)"
              opacity="0.4"
              className="transition-all duration-1000 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold font-mono", textMap[size])} style={{ color }}>
            {score !== null ? score : "—"}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: score !== null ? color : "#6B7280" }}>
          {getFaixaNome(score)}
        </span>
      )}
    </div>
  );
}

export { getFaixaColor, getFaixaNome };

interface AuraBadgeProps {
  membroId: string | null | undefined;
  className?: string;
}

export function AuraBadge({ membroId, className }: AuraBadgeProps) {
  const { data } = useQuery<{ score: number | null; n: number; faixa: string | null }>({
    queryKey: ["/api/aura/score", membroId],
    enabled: !!membroId,
    staleTime: 5 * 60 * 1000,
  });

  if (!membroId || !data || data.score === null) return null;

  const color = getFaixaColor(data.score);

  return (
    <div
      className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border", className)}
      style={{ background: `${color}15`, borderColor: `${color}40`, color }}
      title={`Aura: ${data.faixa} (${data.score})`}
      data-testid="badge-aura"
    >
      <Sparkles className="w-2.5 h-2.5 shrink-0" />
      <span className="font-mono">{data.score}</span>
    </div>
  );
}
