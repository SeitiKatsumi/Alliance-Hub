import { sql } from "drizzle-orm";

const PAYMENT_REMINDER_ACTION = "lembrete_vencimento_2d";
const PAYMENT_REMINDER_TIME_ZONE = "America/Sao_Paulo";

type MemberContact = {
  id?: string | number | null;
  nome?: string | null;
  Nome_de_usuario?: string | null;
  email?: string | null;
  cadastro_geral_id?: MemberContact | null;
};

type BiaContact = {
  id?: string | number | null;
  codigo_publico?: string | null;
  nome_bia?: string | null;
  diretor_capital?: MemberContact | null;
};

export type PaymentReminderItem = {
  id: string | number;
  bia?: BiaContact | string | number | null;
  tipo?: string | null;
  status?: string | null;
  data_vencimento?: string | null;
  descricao?: string | null;
  valor?: string | number | null;
  membro_responsavel?: MemberContact | null;
};

export type PaymentReminderRecipient = {
  id: string | null;
  nome: string;
  email: string;
  source: "responsavel" | "diretor_capital";
};

type DeliveryDependencies = {
  reserve: () => Promise<string | null>;
  send: () => Promise<{ ok: boolean }>;
  markSent: (reservationId: string) => Promise<void>;
  release: (reservationId: string) => Promise<void>;
};

function normalized(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function calendarDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function paymentReminderTargetDate(now = new Date()): string {
  const localDate = calendarDateInTimeZone(now, PAYMENT_REMINDER_TIME_ZONE);
  const target = new Date(`${localDate}T12:00:00Z`);
  target.setUTCDate(target.getUTCDate() + 2);
  return target.toISOString().slice(0, 10);
}

export function isPaymentReminderCandidate(item: PaymentReminderItem, targetDate: string): boolean {
  return normalized(item.tipo) === "saida"
    && normalized(item.status) === "agendado"
    && /^\d{4}-\d{2}-\d{2}$/.test(String(item.data_vencimento || ""))
    && item.data_vencimento === targetDate;
}

function contactFrom(value: MemberContact | null | undefined): MemberContact | null {
  if (!value || typeof value !== "object") return null;
  return value.cadastro_geral_id && typeof value.cadastro_geral_id === "object"
    ? value.cadastro_geral_id
    : value;
}

function validRecipient(value: MemberContact | null | undefined, source: PaymentReminderRecipient["source"]): PaymentReminderRecipient | null {
  const contact = contactFrom(value);
  const email = String(contact?.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return {
    id: contact?.id == null ? null : String(contact.id),
    nome: String(contact?.nome || contact?.Nome_de_usuario || "Responsável financeiro"),
    email,
    source,
  };
}

export function paymentReminderRecipient(item: PaymentReminderItem): PaymentReminderRecipient | null {
  const responsible = validRecipient(item.membro_responsavel, "responsavel");
  if (responsible) return responsible;
  const bia = item.bia && typeof item.bia === "object" ? item.bia : null;
  return validRecipient(bia?.diretor_capital, "diretor_capital");
}

export async function deliverPaymentReminder(deps: DeliveryDependencies): Promise<"sent" | "duplicate" | "retry"> {
  const reservationId = await deps.reserve();
  if (!reservationId) return "duplicate";
  try {
    const result = await deps.send();
    if (!result.ok) {
      await deps.release(reservationId);
      return "retry";
    }
    await deps.markSent(reservationId);
    return "sent";
  } catch (error) {
    await deps.release(reservationId);
    throw error;
  }
}

function relationId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    return id == null ? null : String(id);
  }
  return String(value);
}

function moneyValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value || "").trim();
  const parsed = Number(raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchPaymentReminderItems(targetDate: string): Promise<PaymentReminderItem[]> {
  const directusUrl = String(process.env.DIRECTUS_URL || "").replace(/\/$/, "");
  const directusToken = process.env.DIRECTUS_TOKEN;
  if (!directusUrl || !directusToken) throw new Error("Directus nao configurado para lembretes financeiros.");

  const query = new URLSearchParams({
    "filter[tipo][_eq]": "saida",
    "filter[status][_eq]": "agendado",
    "filter[data_vencimento][_eq]": targetDate,
    fields: [
      "id", "tipo", "status", "data_vencimento", "descricao", "valor",
      "membro_responsavel.id", "membro_responsavel.nome", "membro_responsavel.Nome_de_usuario", "membro_responsavel.email",
      "bia.id", "bia.codigo_publico", "bia.nome_bia",
      "bia.diretor_capital.id", "bia.diretor_capital.nome", "bia.diretor_capital.Nome_de_usuario", "bia.diretor_capital.email",
    ].join(","),
    limit: "-1",
  });
  const response = await fetch(`${directusUrl}/items/fluxo_caixa?${query}`, {
    headers: { Authorization: `Bearer ${directusToken}` },
  });
  if (!response.ok) throw new Error(`Directus retornou ${response.status} ao consultar lembretes financeiros.`);
  const body = await response.json() as { data?: PaymentReminderItem[] };
  return Array.isArray(body.data) ? body.data : [];
}

async function ensurePaymentReminderIndex(database: any) {
  await database.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fluxo_caixa_historico_lembrete_2d
    ON fluxo_caixa_historico (fluxo_caixa_id, (payload->>'data_vencimento'))
    WHERE acao = 'lembrete_vencimento_2d'
  `);
}

export async function processPaymentReminders(now = new Date()) {
  const [{ db }, { enviarLembreteVencimentoPagamento }] = await Promise.all([
    import("./db"),
    import("./mailer"),
  ]);
  await ensurePaymentReminderIndex(db);
  const targetDate = paymentReminderTargetDate(now);
  const items = (await fetchPaymentReminderItems(targetDate)).filter((item) => isPaymentReminderCandidate(item, targetDate));
  const totals = { candidates: items.length, sent: 0, duplicate: 0, retry: 0, skipped: 0 };

  for (const item of items) {
    const recipient = paymentReminderRecipient(item);
    if (!recipient) {
      totals.skipped += 1;
      console.warn(`[payment-reminders] Lancamento ${item.id} sem responsavel ou Diretor de Capital com email.`);
      continue;
    }
    const bia = item.bia && typeof item.bia === "object" ? item.bia : null;
    const biaId = relationId(item.bia);
    const dueDate = String(item.data_vencimento);
    try {
      const result = await deliverPaymentReminder({
        reserve: async () => {
          const payload = JSON.stringify({
            data_vencimento: dueDate,
            status: "reservado",
            destinatario_origem: recipient.source,
            destinatario_membro_id: recipient.id,
          });
          const reservation = await db.execute(sql`
            INSERT INTO fluxo_caixa_historico (fluxo_caixa_id, bia_id, acao, origem, payload)
            VALUES (${String(item.id)}, ${biaId}, ${PAYMENT_REMINDER_ACTION}, 'cron', ${payload}::jsonb)
            ON CONFLICT DO NOTHING
            RETURNING id
          `);
          return reservation.rows?.[0]?.id ? String(reservation.rows[0].id) : null;
        },
        send: () => enviarLembreteVencimentoPagamento({
          destinatarioEmail: recipient.email,
          destinatarioNome: recipient.nome,
          biaNome: String(bia?.nome_bia || "BIA"),
          biaRef: String(bia?.codigo_publico || bia?.id || biaId || ""),
          descricao: String(item.descricao || "Pagamento agendado"),
          valor: moneyValue(item.valor),
          dataVencimento: dueDate,
        }),
        markSent: async (reservationId) => {
          const sent = JSON.stringify({ status: "enviado", enviado_em: new Date().toISOString() });
          await db.execute(sql`UPDATE fluxo_caixa_historico SET payload = payload || ${sent}::jsonb WHERE id = ${reservationId}`);
        },
        release: async (reservationId) => {
          await db.execute(sql`DELETE FROM fluxo_caixa_historico WHERE id = ${reservationId}`);
        },
      });
      totals[result] += 1;
    } catch (error: any) {
      totals.retry += 1;
      console.error(`[payment-reminders] Falha no lancamento ${item.id}:`, error?.message || error);
    }
  }

  return totals;
}
