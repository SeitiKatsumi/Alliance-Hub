export interface PhotoPositionSource {
  foto_posicao_x?: number | string | null;
  foto_posicao_y?: number | string | null;
}

export const PHOTO_POSITION_PRESETS = [
  { label: "Superior esquerdo", short: "↖", x: 0, y: 0 },
  { label: "Superior centro", short: "↑", x: 50, y: 0 },
  { label: "Superior direito", short: "↗", x: 100, y: 0 },
  { label: "Meio esquerdo", short: "←", x: 0, y: 50 },
  { label: "Centro", short: "●", x: 50, y: 50 },
  { label: "Meio direito", short: "→", x: 100, y: 50 },
  { label: "Inferior esquerdo", short: "↙", x: 0, y: 100 },
  { label: "Inferior centro", short: "↓", x: 50, y: 100 },
  { label: "Inferior direito", short: "↘", x: 100, y: 100 },
];

export function clampPhotoPosition(value: unknown, fallback = 50): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getPhotoObjectPosition(source?: PhotoPositionSource | null): string {
  const x = clampPhotoPosition(source?.foto_posicao_x);
  const y = clampPhotoPosition(source?.foto_posicao_y);
  return `${x}% ${y}%`;
}
