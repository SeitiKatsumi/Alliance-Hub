# Acesso, Cadastro e Onboarding

## Objetivo e usuarios

Controla a entrada de usuarios, criacao da identidade, recuperacao de acesso, convites, aceite dos documentos obrigatorios e conclusao progressiva do perfil. Atende visitantes, candidatos, membros, funcionarios de empresas e administradores.

## Telas e URLs

- `/login`: login local e Google.
- `/convite/:token` e `/adesao/:token`: entrada publica por convite.
- `/pagamento/:token` e `/pagamento/sucesso`: adesao paga.
- `/aguardando-aprovacao`: estado anterior a liberacao.
- `/meu-perfil`: conclusao cadastral e documentos aceitos.
- Implementacao principal: `client/src/pages/login.tsx`, `client/src/pages/convite.tsx`, `client/src/pages/adesao.tsx`, `client/src/pages/meu-perfil.tsx` e `client/src/App.tsx`.

## APIs e tarefas

- `/api/login`, `/api/logout`, `/api/me`, `/api/register` e `/api/register/validate`.
- `/api/auth/google/*`, recuperacao e alteracao de senha.
- `/api/convites/*`, `/api/meu-convite`, `/api/convite-publico/*`.
- `/api/me/documentos-aceitos/*` e endpoints de aceite associados ao cadastro ou convite.
- Sessao persistida pelo Express; polling de `/api/me` mantem identidade e permissoes atualizadas.

## Dados e fontes de verdade

- PostgreSQL: `users`, `password_reset_tokens`, `convites_link`, `company_employee_accounts` e registros locais de aceite.
- Directus: `cadastro_geral` para perfil do membro.
- Usuario autenticavel e membro da rede sao identidades relacionadas, mas nao intercambiaveis. IDs devem ser normalizados por helper.

## Papeis e permissoes

- Rotas de autenticacao e convite possuem trechos publicos estritamente limitados.
- Dados completos do perfil exigem sessao e autorizacao.
- Funcionario usa identidade propria e herda apenas os acessos empresariais explicitamente concedidos.
- Admin e superadmin nao dispensam validacao de sessao, rastreabilidade ou aceite exigido.

## Estados e transicoes

`convidado -> cadastro iniciado -> documentos aceitos -> pagamento/aprovacao -> acesso liberado`.

Estados de convite, pagamento e usuario devem ser idempotentes. Repetir callback, refresh ou webhook nao pode criar outro usuario, pagamento ou aceite.

## Invariantes

- E-mail normalizado nao pode identificar duas contas ativas diferentes.
- Aceite registra versao, identidade, data/hora e evidencia do momento.
- Localizacao do aceite e capturada pelo navegador; perfil/endereco nao a substituem.
- Falha de sincronizacao com Directus nao pode ser apresentada como cadastro concluido sem pendencia explicita.
- Retornos publicos nunca incluem hash de senha, token interno ou dados pessoais desnecessarios.

## Efeitos e dependencias

- Envia e-mails, registra eventos de uso, pode criar membro/comunidade e libera modulos.
- Afeta Perfil, Comunidades, Administracao, Pagamentos, Aura e qualquer verificacao de papel.
- PDFs de aceite dependem de dados versionados, fonte UTF-8 e acesso protegido.

## Testes e impacto

- `client/src/lib/profile-completion.test.ts`
- `shared/company-access.test.ts`
- Ao alterar: testar login local/Google, convite novo/reutilizado/expirado, aceite com e sem permissao, recuperacao de senha, perfil parcial, desktop e mobile.
