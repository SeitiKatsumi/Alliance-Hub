import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { requestHash, type AsaasStore } from "./store";

const resourceSchema = z.object({ id: z.string().min(1).max(255) }).passthrough();
const eventSchema = z.object({
  id: z.string().min(1).max(255), event: z.string().regex(/^[A-Z][A-Z0-9_]{1,127}$/),
  account: resourceSchema.optional(), payment: resourceSchema.optional(), transfer: resourceSchema.optional(),
  subscription: resourceSchema.optional(), checkout: resourceSchema.optional(), accessToken: resourceSchema.optional(),
}).passthrough();

export function validWebhookToken(received: string | undefined, expected: string): boolean {
  if (!received || !expected || received.length > 1024) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export async function recordSandboxEvent(store: AsaasStore, body: unknown) {
  const event = eventSchema.parse(body);
  const entity = (["payment", "transfer", "subscription", "checkout", "accessToken"] as const).find(key => event[key]);
  // Somente referências: não armazenar credenciais/documentos/payload integral nesta base.
  const summary = { id: event.id, event: event.event, accountId: event.account?.id || null, entityType: entity || null, entityId: entity ? event[entity]!.id : null };
  return store.receiveEvent({ id: event.id, type: event.event, accountId: summary.accountId, entityType: summary.entityType, entityId: summary.entityId, hash: requestHash(summary), summary });
}
