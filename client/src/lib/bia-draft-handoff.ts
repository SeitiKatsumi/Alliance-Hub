import { biaSetupSchema, type BiaSetup } from '@shared/bia-setup';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
// Three-way merge: untouched editor fields never overwrite newer draft data.
export function mergeSetupEdits(base: BiaSetup, edited: BiaSetup, draft: BiaSetup): BiaSetup {
  function merge(a: any, b: any, c: any): any {
    if (same(a, b)) return c;
    if (same(a, c) || same(b, c)) return b;
    if (Array.isArray(a) && Array.isArray(b) && Array.isArray(c) && [...a, ...b, ...c].every(x => x?.id)) {
      const ids = [...new Set([...c, ...b, ...a].map(x => x.id))];
      return ids.map(id => merge(a.find(x => x.id === id), b.find(x => x.id === id), c.find(x => x.id === id))).filter(x => x !== undefined);
    }
    if (a && b && c && !Array.isArray(a) && typeof a === 'object' && typeof b === 'object' && typeof c === 'object') {
      return Object.fromEntries([...new Set([...Object.keys(a), ...Object.keys(b), ...Object.keys(c)])].map(k => [k, merge(a[k], b[k], c[k])]));
    }
    throw new Error('O mesmo campo foi alterado no rascunho. Suas alterações continuam nesta tela; revise o conflito antes de continuar.');
  }
  return biaSetupSchema.parse(merge(base, edited, draft));
}

// Tab-local, single-use handoff. No property data in URLs or persistent storage.
type Handoff = { setup: BiaSetup; revision: number };
const handoffs = new Map<string, Handoff>();
export function keepDraftHandoff(id: string, handoff: Handoff) { handoffs.set(id, handoff); }
export function takeDraftHandoff(id: string) { const value = handoffs.get(id); handoffs.delete(id); return value; }
export function draftSectionStep(section: string | null) { return ({ juridico: 3, ativos: 4, orcamento: 5 } as Record<string, number>)[section || ''] ?? 0; }
