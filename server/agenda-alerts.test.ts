import assert from "node:assert/strict";
import test from "node:test";
import {
  activeAgendaAlertCount,
  listMouRevisionAlerts,
  agendaAlertBadge,
  dedupeAgendaAlertItems,
  type AgendaAlertItem,
} from "./agenda-alerts";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

test("alerta de MOU usa destinatário/revisão vigente, deduplica e some após aceite sem alterar dados",async()=>{
  const pg=new PGlite();try{
    await pg.exec(`CREATE TABLE agenda_tarefas(id text,user_id text,membro_id text,titulo text,descricao text,atualizado_em timestamp DEFAULT now(),contexto_id text,contexto_tipo text,status text,origem_tarefa_id text);
      CREATE TABLE bia_map_inicial_snapshots(bia_id text,revisao int,ativado_em timestamp);
      CREATE TABLE bia_mou_aceites(bia_id text,membro_id text,mou_versao text,map_revisao int);
      INSERT INTO bia_map_inicial_snapshots VALUES ('bia',2,null),('other',1,null),('active',1,now());
      INSERT INTO agenda_tarefas(id,user_id,membro_id,descricao,contexto_id,contexto_tipo,status,origem_tarefa_id) VALUES
        ('old','u','m','antigo','bia','bia','pendente','map:bia:1'),
        ('new','u','m','atual','bia','bia','pendente','map:bia:2'),
        ('copy','u','m','atual','bia','bia','pendente','map:bia:2'),
        ('foreign','other-user','m','privado','bia','bia','pendente','map:bia:2'),
        ('removed','u','m','outra BIA','other','bia','pendente','map:other:1'),
        ('active','u','m','ativada','active','bia','pendente','map:active:1');
      INSERT INTO bia_mou_aceites VALUES ('bia','m','current',1),('bia','other-member','current',2),('bia','m','old',2);
    `);
    const db=drizzle(pg),eligible=async(id:string)=>id==='bia';
    const result=await listMouRevisionAlerts(db,'u','m','current',eligible);
    assert.equal(result.length,1);assert.equal(result[0].source_id,'bia:2');assert.equal(result[0].href,'/convites-alianca');assert.equal(activeAgendaAlertCount(result),1);
    assert.equal((await listMouRevisionAlerts(db,'other-user','different-member','current',eligible)).length,0);
    assert.equal((await listMouRevisionAlerts(db,'u',null,'current',eligible)).length,0);
    await assert.rejects(listMouRevisionAlerts(db,'u','m','current',async()=>{throw new Error('indisponível');}));
    await pg.exec("INSERT INTO bia_mou_aceites VALUES ('bia','m','current',2)");
    assert.equal((await listMouRevisionAlerts(db,'u','m','current',eligible)).length,0);
    assert.equal((await pg.query<any>('SELECT count(*)::int AS n FROM agenda_tarefas')).rows[0].n,6);
  }finally{await pg.close();}
});

function item(overrides: Partial<AgendaAlertItem> = {}): AgendaAlertItem {
  return {
    id: "alert-1",
    source_type: "convite",
    source_id: "source-1",
    group: "pendencias",
    category: "convite",
    title: "Convite pendente",
    priority: "alta",
    status: "pendente",
    action_required: true,
    active: true,
    href: "/agenda-alertas?view=alertas",
    actions: ["aceitar", "recusar"],
    ...overrides,
  };
}

test("deduplica a mesma origem encontrada por relacoes diferentes", () => {
  const alerts = dedupeAgendaAlertItems([
    item(),
    item({ id: "alert-copy", priority: "media" }),
  ]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].priority, "alta");
});

test("contador inclui apenas pendencias ativas e acionaveis", () => {
  const total = activeAgendaAlertCount([
    item(),
    item({ source_id: "update", group: "atualizacoes", action_required: false }),
    item({ source_id: "history", group: "historico", active: false }),
    item({ source_id: "resolved", active: false }),
  ]);
  assert.equal(total, 1);
});

test("badge fica oculto em zero e limitado a 99+", () => {
  assert.equal(agendaAlertBadge(0), null);
  assert.equal(agendaAlertBadge(12), 12);
  assert.equal(agendaAlertBadge(100), "99+");
});
