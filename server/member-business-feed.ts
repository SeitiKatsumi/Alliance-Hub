export type BusinessFeedProfile = {
  specialties?: unknown[];
  contributionAreas?: unknown[];
  branches?: unknown[];
  nuclei?: unknown[];
  city?: unknown;
  state?: unknown;
  country?: unknown;
};

export type BusinessFeedCandidate = {
  title?: unknown;
  description?: unknown;
  specialties?: unknown[];
  branch?: unknown;
  nucleus?: unknown;
  city?: unknown;
  state?: unknown;
  country?: unknown;
  urgency?: unknown;
  interested?: boolean;
  delivered?: boolean;
  publishedAt?: Date | string | null;
};

export type BusinessFeedContext = "recomendado" | "em_andamento" | "agenda" | "convite";

export type BusinessFeedContextCandidate = {
  type?: unknown;
  interested?: boolean;
  delivered?: boolean;
  managed?: boolean;
};

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(values: unknown[]) {
  return new Set(
    values
      .flatMap((value) => normalize(value).split(" "))
      .filter((word) => word.length >= 3),
  );
}

function overlap(left: Set<string>, right: Set<string>) {
  let total = 0;
  left.forEach((value) => {
    if (right.has(value)) total += 1;
  });
  return total;
}

export function scoreBusinessFeedCandidate(profile: BusinessFeedProfile, candidate: BusinessFeedCandidate) {
  const profileSpecialties = words([
    ...(profile.specialties || []),
    ...(profile.contributionAreas || []),
    ...(profile.branches || []),
    ...(profile.nuclei || []),
  ]);
  const opportunityTerms = words([
    candidate.title,
    candidate.description,
    ...(candidate.specialties || []),
    candidate.branch,
    candidate.nucleus,
  ]);
  const sharedTerms = overlap(profileSpecialties, opportunityTerms);
  const reasons: string[] = [];
  let score = 24;

  if (sharedTerms > 0) {
    score += Math.min(42, sharedTerms * 12);
    reasons.push(sharedTerms === 1 ? "Compatível com seu perfil" : `${sharedTerms} competências compatíveis`);
  }

  const profileCity = normalize(profile.city);
  const profileState = normalize(profile.state);
  const profileCountry = normalize(profile.country);
  const candidateCity = normalize(candidate.city);
  const candidateState = normalize(candidate.state);
  const candidateCountry = normalize(candidate.country);
  if (profileCity && candidateCity && profileCity === candidateCity) {
    score += 18;
    reasons.push("Na sua cidade");
  } else if (profileState && candidateState && profileState === candidateState) {
    score += 12;
    reasons.push("No seu estado");
  } else if (profileCountry && candidateCountry && profileCountry === candidateCountry) {
    score += 5;
    reasons.push("No seu país");
  }

  if (candidate.delivered) {
    score += 10;
    reasons.push("Enviada diretamente para você");
  }
  if (candidate.interested) {
    score += 12;
    reasons.push("Você já demonstrou interesse");
  }
  if (["alta", "urgente"].includes(normalize(candidate.urgency))) {
    score += 5;
    reasons.push("Prioridade alta");
  }

  const publishedAt = candidate.publishedAt ? new Date(candidate.publishedAt) : null;
  if (publishedAt && !Number.isNaN(publishedAt.getTime())) {
    const ageDays = Math.max(0, (Date.now() - publishedAt.getTime()) / 86_400_000);
    if (ageDays <= 7) score += 5;
  }

  if (reasons.length === 0) reasons.push("Disponível para membros BUILT");
  return { score: Math.min(100, Math.round(score)), reasons: reasons.slice(0, 2) };
}

export function classifyBusinessFeedContext(candidate: BusinessFeedContextCandidate): BusinessFeedContext {
  const type = normalize(candidate.type);
  if (type === "ro") return "agenda";
  if (type === "bia") return "convite";
  if (candidate.interested || candidate.delivered || candidate.managed) return "em_andamento";
  return "recomendado";
}

export function sortBusinessFeed<T extends { aderencia: number; data?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (b.aderencia !== a.aderencia) return b.aderencia - a.aderencia;
    return new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime();
  });
}
