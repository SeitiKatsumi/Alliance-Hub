import type { MailCategory } from '../shared/user-preferences';

type Policy = (to: string, category: MailCategory) => Promise<boolean>;
let policy: Policy | undefined;
export function configureEmailPreferencePolicy(value: Policy) { policy = value; }
export async function emailDeliveryDecision(to: string, category: MailCategory): Promise<'send'|'suppressed'|'unavailable'> {
  if (category === 'essential') return 'send';
  if (!policy) return 'unavailable';
  try { return await policy(to,category) ? 'send' : 'suppressed'; }
  catch { return 'unavailable'; } // Never send an optional message when opt-out cannot be checked.
}
