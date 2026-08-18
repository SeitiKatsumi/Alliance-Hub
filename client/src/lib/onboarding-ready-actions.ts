export const ONBOARDING_READY_DESTINATION_HREFS = {
  imovel: "/carteira/novo",
  profissional: "/meu-perfil",
  capital: "/built-capital",
  rede: "/vitrine/parceiros",
} as const;

export type OnboardingReadyDestination = keyof typeof ONBOARDING_READY_DESTINATION_HREFS;

export function onboardingAcceptanceUrl(destination: OnboardingReadyDestination): string {
  return `/onboarding/aceites?destino=${encodeURIComponent(destination)}`;
}

export function onboardingReadyDestinationFromSearch(search: string): OnboardingReadyDestination | null {
  const destination = new URLSearchParams(search).get("destino");
  return destination && destination in ONBOARDING_READY_DESTINATION_HREFS
    ? destination as OnboardingReadyDestination
    : null;
}

export function onboardingReadyDestinationHref(destination: unknown): string | null {
  const key = String(destination || "") as OnboardingReadyDestination;
  return ONBOARDING_READY_DESTINATION_HREFS[key] || null;
}
