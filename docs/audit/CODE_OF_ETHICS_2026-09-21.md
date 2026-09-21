# Código de Ética — 21/09/2026

- Fonte: `BUILT JUR - 1. Código de Ética BUILT.docx`, enviado pelo usuário; seis cláusulas extraídas do XML do documento, preservadas com numeração 01–06.
- Texto e versão vigentes centralizados em `shared/code-of-ethics.ts`. App, adesão/login e API pública reutilizam a mesma fonte. Não há migração, edição de dados, envio de mensagens ou exigência retroativa de novo aceite.
- Nova identificação interna: `BUILT JUR - 1 — 2026-09-21` (data de atualização no sistema, não data presumida de assinatura).
- Comprovantes resolvem a versão registrada: `BUILT JUR - 1` mantém o texto anterior. Sem versão conhecida, mostram metadados e aviso de texto histórico não mapeado; não atribuem a versão atual. Auditoria tem prioridade sobre fallbacks de cadastro/convite.
- Consulta pública do texto continua pública; acesso aos comprovantes e gravação dos aceites preservam autenticação, autorização e evidências existentes. PostgreSQL/Directus mantêm os registros anteriores. MOU, notificações, e-mails e cálculos não foram alterados.

## Verificação

- Baseline antes/depois: 66 diagnósticos TypeScript, idênticos após normalizar posições de linha/coluna.
- 275 testes aprovados; build aprovado.
- `platform:verify`: contrato válido (11 módulos, 98 funcionalidades); interrompido pelo TypeScript legado. Testes e build executados separadamente.
- API local `/api/termos-aceite/codigo_etica` confirmou versão e seis cláusulas atualizadas.
- Não foi concluída a validação visual desktop/mobile do modal autenticado nem a emissão real de comprovante: sessão local encerrada. Nenhuma conta ou aceite criado para contornar esse limite. Regressão da seleção de texto por versão coberta pelos testes.
- Sem commit, push ou implantação no CapRover.
