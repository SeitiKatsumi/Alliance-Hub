# Separação DM, MAP e aportes — 21/09/2026

## Escopo e fonte oficial

Reorganização de interface, preservando alterações anteriores do workspace. Nenhuma migração, nova biblioteca, alteração de fórmula, criação de BIA ou mudança de autorização no servidor.

- DM continua em `capital=calculadora`/`capital_calculadora`, mas mostra somente índices individuais, Valor de Origem de referência e equivalentes. Pessoas/cargos/capital continuam na mesma composição PostgreSQL, não em outro cadastro.
- `/movimentacao-cotas/:biaId?view=atual|zero|historico` preserva o MAP Atual e movimentações existentes. MAP Zero inicia em leitura e abre explicitamente o formulário compartilhado; comparação expansível e histórico/PDFs separados.
- Financeiro abre em Lançamentos. Modelo 3 dispõe de `capital=financeiro&financeiro=aportes`; o componente de cronogramas foi removido da calculadora, não duplicado. Atalho antigo com `#aportes-iniciais` redireciona.
- `GET/PUT map-inicial`, cálculo compartilhado, revisão esperada, motivos e permissões do backend permanecem oficiais. A consulta e o editor são compartilhados entre DM e MAP Zero. O PUT do DM conserva a composição e modifica os índices; CPP ausente não é inferida.
- Fonte patrimonial: snapshots/versões PostgreSQL. Execução financeira: parcelas PostgreSQL e movimentos Directus existentes. E-mails, MOU/PDF, notificações e tarefas automáticas permanecem consumidores das mesmas APIs; nenhum template ou documento assinado foi alterado.
- Rascunhos guardam a revisão de origem e não absorvem refetch enquanto sujos. Conflito reconsulta a base sem apagar campos; falha de atualização bloqueia gravar, não descarta a edição. Saída/navegação exige confirmação; recarregar/fechar usa a proteção nativa.
- BIAs sem snapshot só são consideradas legadas diante do código explícito `LEGACY_BIA_MAP`; indisponibilidade/404 de BIA inexistente não habilitam fallback financeiro.

## Validação automatizada

- Baseline anterior: 265 testes e 66 diagnósticos TypeScript legados.
- 272 testes aprovados, incluindo sete novos em `client/src/pages/dm-map-navigation.test.ts`. Executam callbacks reais de cálculo, carregamento, salvamento, revalidação, redirecionamento e bloqueio de navegação. Abrangem índice zero, cargos acumulados, CPP ausente, revisão esperada antiga e falha segura. Suítes existentes de API/histórico/aportes também aprovadas, incluindo concorrência, autorização, confirmação repetida, reversões e preservação de aceites.
- Build aprovado. `platform:verify`: contrato válido, 11 módulos/98 funcionalidades; interrompe no typecheck com os mesmos 66 diagnósticos, comparados ignorando somente deslocamentos de linha/coluna. Testes e build executados separadamente por essa limitação preexistente.
- Impacto executado antes e depois em Calculadora, Núcleo de Capital e Movimentação de Cotas. Contratos de Capital e Alliances atualizados.
- Logs: `.codex-tmp/dm-separation-tests-final.log`, `dm-separation-build-final.log`, `dm-separation-verify-final.log`, `dm-separation-impact-final.log`, `dm-separation-map-impact.log`.

## Validação real no localhost

Usada somente a BIA fictícia previamente autorizada BJPPTLABY6, com participantes de teste Luhan.

- DM desktop/mobile 390px: uma linha/cartão por pessoa, nomes/cargos legíveis, índices zero e 12,5%, VO R$ 1.500.000 e contribuição R$ 187.500. DM positivo em participante sem CPP bloqueou Salvar e ofereceu link para composição. Alteração apenas local descartada, sem gravação.
- Salvar DM sem mudanças completou no endpoint real sem criar revisão, parcela ou lançamento.
- Abrir MAP abriu MAP Atual por padrão, preservando visual de Guardiões/Multiplicadores e movimentações. MAP Zero apresentou BEI R$ 1.687.500, percentuais 88,88889%/11,11111% e editor somente após ação explícita. Abrir/cancelar editor sem mudanças conferido.
- Histórico exibiu revisões 1, 2 e 3, comparação e link de PDF da revisão. Nenhum PDF foi regenerado ou sobrescrito.
- Link antigo de aportes abriu a nova seção; sair e reabrir Financeiro restaurou Lançamentos como padrão.
- Confirmação repetida dos cronogramas existentes completou sem duplicar. Registro fictício de integralização de Luhan4 atualizou os dois movimentos compensatórios sem caixa; reversão voltou ambos a agendado. Não houve transferência bancária.
- Consulta independente PostgreSQL/Directus após o teste: plano revisão 7 confirmado, 29 parcelas/36 movimentos nos mesmos IDs, categorias/CPPs corretas, nenhum pago, zero cobranças, MAP Zero revisão 3 e três versões preservadas. O histórico financeiro conserva a integralização/reversão de teste; não foi apagado.
- MAP Atual, MAP Zero e controles financeiros conferidos em 390px; viewport restaurado ao final.

## Limites explícitos

- O diálogo nativo de descarte foi aberto no navegador integrado, mas impediu a automação de continuar naquela aba. A aba de teste foi encerrada e as demais verificações continuaram em outra. Cancelar/confirmar navegação, descarte e unload foram verificados por teste executável do hook; não se afirma que o cancelamento nativo foi concluído pela automação visual. Em navegadores antigos sem Navigation API, o fallback restaura formulário/URL, mas não o cursor original do histórico.
- Conflito entre duas escritas, somente leitura e correção ativa foram cobertos pelas suítes automatizadas, não por novas sessões reais de todos os papéis nesta rodada.
- Não houve novo aceite jurídico, pagamento bancário, teste completo dos provedores externos, commit/push ou deploy. Não se trata de homologação integral da plataforma.
