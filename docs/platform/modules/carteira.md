# Carteira Patrimonial

## Objetivo e usuarios

Mantem o patrimonio privado do usuario, seus imoveis, receitas, despesas, documentos, pulsos, alertas, diagnosticos, compartilhamentos e demandas.

## Telas e URLs

- `/carteira`, `/carteira/:id` e `/carteira/novo`.
- `/oportunidades`, `/oportunidades/nova` e `/oportunidades/:id` para a jornada imobiliaria externa.
- Implementacao principal em `client/src/pages/carteira.tsx`, `client/src/pages/carteira-assistente.tsx` e `client/src/pages/oportunidades-imobiliarias.tsx`.

## APIs

- `/api/carteira/resumo`, `/imoveis*`, `/lancamentos*`, `/documentos*`.
- Pulsos, alertas, diagnostico, alternativas, demandas, acessos e transferencia de proprietario.
- Assistente de cadastro e publicacao opcional em Banco de Ativos/Vitrine.

## Dados e fontes de verdade

- PostgreSQL `inventario_imoveis`, `inventario_lancamentos`, `carteira_eventos`, `carteira_documentos`, `carteira_analises`, `carteira_alertas`, `carteira_demandas`, acessos e sessoes do assistente.
- Historico de evento e append-only; o snapshot atual nao substitui a trilha.
- Ativo publicado e uma projecao/copia rastreada, nao a fonte do item privado.

## Papeis e permissoes

- Proprietario: controle total e transferencia consciente.
- Convidado: leitura, colaboracao ou administracao conforme acesso explicito e validade.
- Administrador da plataforma nao recebe acesso automatico ao patrimonio privado sem regra operacional auditavel.
- Arquivo e dado privado exigem autorizacao sobre o imovel pai.

## Estados e transicoes

- Imovel: ativo, arquivado ou transferido; publicacao e compartilhamento possuem estados proprios.
- Documento: versao ativa, substituida, expirada ou removida conforme politica.
- Alerta: aberto, em andamento, resolvido ou ignorado com justificativa.
- Demanda: rascunho, publicada, atendida ou encerrada.

## Invariantes

- Carteira e financeiro de BIA nunca se misturam automaticamente.
- Edicao relevante gera evento com autor, origem e horario.
- IA propoe dados; confirmacao humana grava o snapshot oficial.
- Compartilhar um imovel nao compartilha toda a Carteira.
- Publicar e opt-in, reversivel e deve mascarar dados privados.

## Efeitos e dependencias

- Alimenta Agenda/Alertas, Vitrine, Banco de Ativos, oportunidades economicas e rastreabilidade.
- Upload e extracao dependem de Arquivos/OpenAI; lembretes dependem de cron/notificacoes.

## Testes e impacto

- `server/carteira-domain.test.ts`
- `server/carteira-alertas.test.ts`
- `server/property-journey.test.ts`
- `server/market-comparables.test.ts`
- Ao alterar: testar dono/convidado/nao autorizado, evento gerado, publicacao/retirada, documentos, alertas e viewport mobile.
