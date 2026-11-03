import { relationId } from './bia-access';
import { getContributionAreaDisplayName, normalizeContributionAreaValues } from './contribution-areas';
import type { OrganizationMember } from './bia-organization';

export type ParticipantEntry = {
  id: string; bia: unknown; tipo: string; valor: number | string; descricao?: string;
  membro_responsavel?: unknown; Favorecido?: unknown[]; status?: string | null;
  data?: string | null; data_vencimento?: string | null; natureza?: string; conciliacao_pendente?: boolean;
};

/** Identity and BIA scope are explicit; a recorder is not necessarily the payer. */
export function participantEntries(entries: readonly ParticipantEntry[], biaId: string, memberId: string) {
  if (!biaId || !memberId) return [];
  const unique = new Map<string, ParticipantEntry & { beneficiary: boolean; responsible: boolean }>();
  for (const entry of entries) {
    if (!entry.id || relationId(entry.bia) !== biaId) continue;
    const beneficiary = (entry.Favorecido || []).some(value => relationId(value) === memberId);
    const responsible = relationId(entry.membro_responsavel) === memberId;
    if (beneficiary || responsible) unique.set(entry.id, { ...entry, beneficiary, responsible });
  }
  return [...unique.values()].sort((a, b) => String(b.data_vencimento || b.data || '').localeCompare(String(a.data_vencimento || a.data || '')) || a.id.localeCompare(b.id));
}

export function participantContributionAreas(member?: OrganizationMember) {
  let value = member?.tipos_alianca ?? member?.tipo_alianca;
  if (typeof value === 'string') {
    try { const parsed = JSON.parse(value); value = Array.isArray(parsed) ? parsed : value; } catch { /* Legacy single selection. */ }
    if (typeof value === 'string') value = value.split(';').map(item => item.trim());
  }
  return normalizeContributionAreaValues(value).map(getContributionAreaDisplayName);
}
