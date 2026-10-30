/** Public profile name for the signed-in member; never substitutes formal identity. */
export function memberDisplayName(member: { nome?: unknown; Nome_de_usuario?: unknown } | null | undefined, fallback = ""): string {
  for (const value of [member?.nome, member?.Nome_de_usuario, fallback]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
