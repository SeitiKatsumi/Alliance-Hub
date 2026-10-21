import { sql } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";
import { createBiaCommunitySync } from "./bia-community";

/** Strict transport: never authorize or repair relations from a cached/log fallback. */
export function createDirectusBiaCommunitySync(db: any, config: {
  url: string; token: string; communityCollection: () => Promise<string>;
  fetch?: typeof fetch;
}) {
  const request = async (path: string, body?: unknown, method?: "DELETE") => {
    const response = await (config.fetch || fetch)(`${config.url}/items/${path}`, {
      method: method || (body === undefined ? "GET" : "POST"),
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Consulta de vínculo comunitário indisponível (${response.status}).`);
    if (method === "DELETE") return true;
    const json = await response.json();
    if (!Object.hasOwn(json, "data")) throw new Error("Resposta de vínculo comunitário inválida.");
    return json.data;
  };
  const junction = async () => `${(await config.communityCollection()).toLowerCase()}_bias`;
  const lockTransaction = new AsyncLocalStorage<any>();
  const lock = <T>(id: string, work: () => Promise<T>): Promise<T> => db.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`bia-community:${id}`}, 0))`);
    return lockTransaction.run(tx, work);
  });
  const service = createBiaCommunitySync({
    lock,
    bia: async id => {
      const rows = await request(`bias_projetos?${new URLSearchParams({ "filter[id][_eq]": id, fields: "id,autor_bia", limit: "1" })}`);
      return rows[0] || null;
    },
    mother: async authorId => (await (lockTransaction.getStore() || db).execute(sql`
      SELECT comunidade_id FROM membro_comunidade_mae WHERE membro_id = ${authorId} LIMIT 1
    `)).rows[0]?.comunidade_id || null,
    communityExists: async id => {
      const col = await config.communityCollection();
      return (await request(`${col}?${new URLSearchParams({ "filter[id][_eq]": id, fields: "id", limit: "1" })}`)).length === 1;
    },
    linked: async (biaId, communityId) => {
      const col = await config.communityCollection();
      const rows = await request(`${await junction()}?${new URLSearchParams({
        "filter[bias_projetos_id][_eq]": biaId,
        [`filter[${col.toLowerCase()}_id][_eq]`]: communityId, fields: "id", limit: "1",
      })}`);
      return rows.length > 0;
    },
    append: async (biaId, communityId) => {
      const col = await config.communityCollection();
      await request(await junction(), { [`${col.toLowerCase()}_id`]: communityId, bias_projetos_id: biaId });
    },
    list: async authorId => {
      const all: Array<{ id: string }> = [];
      for (let offset = 0; ; offset += 200) {
        const params = new URLSearchParams({ fields: "id", limit: "200", offset: String(offset), sort: "id" });
        if (authorId) params.set("filter[autor_bia][_eq]", authorId);
        const rows = await request(`bias_projetos?${params}`);
        if (!Array.isArray(rows)) throw new Error("Lista de BIAs inválida.");
        all.push(...rows);
        if (rows.length < 200) return all;
      }
    },
  });
  return { ...service,
    // Authorized deletion and rollback use the same lock as repair; otherwise a
    // timer could restore the FK between removal of its row and deletion of BIA.
    remove: (id: string) => lock(id, async () => {
      const col = await junction();
      const links = await request(`${col}?${new URLSearchParams({ "filter[bias_projetos_id][_eq]": id, fields: "id", limit: "-1" })}`);
      for (const link of links) await request(`${col}/${encodeURIComponent(String(link.id))}`, undefined, "DELETE");
      await request(`bias_projetos/${encodeURIComponent(id)}`, undefined, "DELETE");
      return true;
    }),
  };
}
