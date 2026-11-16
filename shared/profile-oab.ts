import { z } from "zod";
import { normalizeContributionAreaValues } from "./contribution-areas";

export const optionalOab = z.string().trim().max(100);

export function hasLegalContribution(areas: unknown): boolean {
  return normalizeContributionAreaValues(areas).includes("Alianças Jurídicas");
}
