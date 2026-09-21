# Nova BIA — Guardiões, Multiplicadores e revisão do fluxo

Data: 2026-09-21. Escopo: criação, edição geral e integração com MAP Zero, aceites e financeiro. Alterações anteriores do workspace preservadas. Sem commit, deploy, migração, criação de BIA real ou envio de convites.

## Alterações e problemas corrigidos

- Nova BIA → Equipe volta a mostrar explicitamente **Guardião / Multiplicador**. Guardião revela o valor comprometido; Multiplicador participa pelo DM e não recebe capital. Trocar para Multiplicador com capital positivo exige confirmação, zera somente esse componente e preserva o DM.
- Selecionar a pessoa pela primeira vez em uma ficha vazia não exige confirmação. Trocar ou remover uma pessoa com dados econômicos preenchidos continua protegido.
- DM ausente recebe mensagem de preenchimento, diferente de índice negativo; zero explícito continua válido.
- A edição geral de uma BIA com MAP Zero enviava campos econômicos legados e podia receber `409`. Agora consulta o modelo, remove esses campos do PATCH e direciona a composição para Capital → MAP e DM. Falha na consulta bloqueia o salvamento; somente `404 / LEGACY_BIA_MAP` libera a edição legada.
- Um PATCH parcial também recalculava o DM pelos percentuais legados, potencialmente zerando os espelhos econômicos de uma BIA nova. O backend deixa de executar esse cálculo quando existe snapshot. A lista dos 20 campos protegidos é compartilhada entre tela e API; a autorização e a rejeição de alteração econômica pela rota geral continuam no backend.
- Falha no salvamento complementar de Informações era ignorada. Agora mostra explicitamente que a BIA foi salva, mas Informações não, orientando reabrir a edição sem criar outra BIA. Essa etapa continua separada, não atômica e com recuperação manual.

## Fontes e consumidores

Participantes e fórmulas continuam em `shared/member-portfolio.ts`; snapshots, revisões e aceites em PostgreSQL; cadastro e execução financeira no Directus conforme os contratos existentes. Não foram criadas novas tabelas, bibliotecas ou fórmulas. Preservados MAP Atual, MOU, PDFs históricos, lançamentos e permissões efetivas por BIA. Nenhum dado legado foi convertido ou recalculado nesta revisão.

## Verificações realizadas

| Verificação | Resultado |
| --- | --- |
| `npm run test:all` | 260 testes aprovados, 64 arquivos, nenhuma falha |
| `npm run build` | Aprovado; avisos de PostCSS/tamanho de bundle continuam |
| `npm run platform:verify` | Contrato aprovado (11 módulos/98 funcionalidades); interrompe no TypeScript |
| TypeScript vs. baseline anterior à alteração | Mesmos 66 diagnósticos, comparados sem números de linha; nenhum novo |
| Testes e build separados após o bloqueio do verify | Aprovados |
| Relatórios de impacto e `git diff --check` | Executados; sem erro de whitespace |
| Localhost após reinício do backend | `/` retorna 200; `/api/me` sem sessão retorna 401 esperado |

Os testes exercitam handlers reais extraídos, helpers de domínio e persistência SQL isolada em PGlite, com serviços externos simulados. Cobrem criação sem caixa, pessoa única/cargos acumulados, validação de CPP, DM zero e ausente, capital inválido, edição geral sem alterar a base, bloqueio dos campos protegidos, autorização, revisão esperada, aceites idempotentes e ativação condicionada a todos os signatários da revisão vigente. Incluem participante com DM zero, preservação de PDF antigo, aportes iniciais sem duplicação de CPP, aportes adicionais pagos versus pendentes, transferências, cronogramas, pares sem caixa e falha/recuperação do Directus.

### Navegador isolado

Conferidos componentes reais com APIs simuladas, sem gravação nas fontes reais:

- Desktop e celular de 390 px: fichas empilhadas, tipos explícitos, seleção de pessoas sem duplicidade e preservação ao alternar abas.
- Cancelar e confirmar troca Guardião → Multiplicador; capital removido somente após confirmação, DM preservado.
- Composição incompleta permanece pendente; valores e classificações obrigatórios não são presumidos.
- Exemplo misto: Valor de Origem R$ 1.500.000, Guardião com DM zero e capital R$ 1.500.000; Multiplicador com DM 12,5% e capital zero. BEI R$ 1.687.500; CPPs R$ 1.500.000 e R$ 187.500; participações 88,88889% e 11,11111%. Formulário sem transbordamento horizontal.
- Edição geral de BIA com snapshot: sem aba DM legada; PATCH observado sem campos econômicos ou instruções de cronograma. BIA legada preserva a aba DM.
- Erro de consulta do modelo bloqueia salvar e oferece tentativa novamente; falha de Informações exibe aviso de sucesso parcial.

### Fontes reais: somente leitura

O PostgreSQL configurado respondeu, com estruturas de snapshots, versões, eventos, aceites por revisão, compromissos e parcelas presentes. Consultas restritas às coleções Directus `Tipos_CPP` e `fluxo_caixa` retornaram HTTP 200. Nenhuma migração foi aplicada nesta revisão. Isso atualiza a constatação de indisponibilidade de 18/09, mas não comprova todas as permissões de escrita ou equivalência integral do schema.

## Limites e homologação restante

Não é uma certificação de ponta a ponta em produção. Não foram criados participantes/BIAs reais, assinados MOUs reais, enviados e-mails ou acionados bancos/provedores de pagamento. A concorrência isolada não substitui homologação com sessões PostgreSQL independentes. A equivalência entre cálculos/documentos tem cobertura automatizada, mas nem todas as páginas consumidoras foram percorridas com dados reais.

Para concluir a homologação integrada, usar BIA e contas dedicadas de teste: criar e reabrir, aceitar a mesma revisão com todos os signatários, ativar, registrar parcelas iniciais e aporte adicional, transferir/reverter e conferir Capital, Carteira, MOU/PDF e histórico. Verificar permissões e recuperação PostgreSQL/Directus, entrega de notificações e concorrência de múltiplas sessões. Os 66 erros TypeScript existentes continuam sendo débito técnico.
