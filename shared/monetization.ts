export const MEMBER_ANNUAL_PRICE_CENTS = 319_700;
export const COMPANY_ANNUAL_PRICE_CENTS = 383_640;
export const COMPANY_UPGRADE_PRICE_CENTS = COMPANY_ANNUAL_PRICE_CENTS - MEMBER_ANNUAL_PRICE_CENTS;
export const COMPANY_INCLUDED_SEATS = 3;
export const COMPANY_ADDITIONAL_SEATS = COMPANY_INCLUDED_SEATS - 1;
export const BIA_MINIMUM_RIG_RATE = 0.01;
export const BIA_GOVERNANCE_MONTHLY_CENTS = 60_000;

export function companyCheckoutAmount(hasActiveIndividualMembership: boolean) {
  return hasActiveIndividualMembership ? COMPANY_UPGRADE_PRICE_CENTS : COMPANY_ANNUAL_PRICE_CENTS;
}

export function calculateRigCents(originValue: unknown, rate: unknown): number | null {
  const value = Number(originValue);
  const percentage = Number(rate);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(percentage) || percentage < BIA_MINIMUM_RIG_RATE) return null;
  return Math.round(value * percentage * 100);
}

export function governanceStartsAt(institutionalStart: Date): Date {
  if (!Number.isFinite(institutionalStart.getTime())) throw new Error("Data de início institucional inválida.");
  const start = new Date(institutionalStart);
  start.setUTCMonth(start.getUTCMonth() + 24);
  return start;
}

export function governanceCompetences(institutionalStart: Date, through: Date): string[] {
  const first = governanceStartsAt(institutionalStart);
  if (first > through) return [];
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  const limit = new Date(Date.UTC(through.getUTCFullYear(), through.getUTCMonth(), 1));
  const result: string[] = [];
  while (cursor <= limit) {
    result.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return result;
}
