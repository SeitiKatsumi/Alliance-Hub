-- Seed de dados iniciais (idempotente — usa ON CONFLICT DO NOTHING)
-- Gerado a partir do banco de desenvolvimento em 2026-04-30

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

-- ─── users ────────────────────────────────────────────────────────────────────
INSERT INTO public.users (id, username, password, nome, email, membro_directus_id, role, permissions, ativo, created_at, google_id) VALUES
  ('98d4ed18-35e9-426b-a523-bc559f3eaf9a', 'rodrigo.admin', '4d82906d9a52038afef61c6e8883530a4fc3171439525b76eb4fcee168ed50167e5c6bcdcb5016353860f9ccb757ed0235db74c38c5e3ee2813df526811d6661.cb6971f6d231cdb8c4a8ac06e8b121f7', 'Rodrigo Admin', 'seitikatsumi@gmail.com', '90d2589b-c318-4562-8421-36c7467475c5', 'admin', '{"aura":"edit","bias":"edit","admin":"edit","painel":"edit","membros":"edit","calculadora":"edit","fluxo_caixa":"edit","oportunidades":"edit","cadastro_geral":"edit"}', true, '2026-03-09 17:32:21.880838', NULL),
  ('f5f31123-89a5-4270-8fa6-3369324c63b9', 'roco.admin', 'directus-managed', 'Roco Admin', 'rocoxxx@gmail.com', NULL, 'admin', '{"aura":"edit","bias":"edit","admin":"edit","painel":"edit","membros":"edit","calculadora":"edit","fluxo_caixa":"edit","oportunidades":"edit","cadastro_geral":"edit"}', true, '2026-04-16 11:36:12.661702', NULL),
  ('fa863cbb-50c7-4d8c-924e-113185c2607a', 'Luhan', 'b60b5a9f068c3fc78ade84f48d3867d2db6c5c3363232ff8d8f73521dc1083b4b043d7d07ea5a416917692f255334012e0c43de6127728cc99542a7b93fbcc2b.ef313273e3971021c502337ad6309a84', 'Luhan Watanabe', 'luhan@gmail.com', NULL, 'user', '{}', true, '2026-04-16 13:25:30.480701', NULL),
  ('5d8d33c5-c078-4cbe-b467-e74044747dbb', 'watanabeluhan', 'a1296bd5bd232e292f9908502c2ccfd059c8efef3e2613e60ba492782ec3575a5e5a3393e4775887a77a1f80c497665741b59b4cc1408dc9a5a130f4effcacc9.6212cdf47a9835f3d27c392b0e51170f', 'LuhanTeste', 'watanabeluhan@gmail.com', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'user', '{"aura":"view","bias":"view","admin":"none","painel":"view","membros":"none","calculadora":"none","fluxo_caixa":"none","oportunidades":"none","cadastro_geral":"none"}', true, '2026-04-20 06:31:22.622889', NULL),
  ('16689234-bce7-49fd-8893-443aefac6a07', 'luhanconvite', 'bd03b157cf19a0b08fe63686bdce527ebbf9d88f2f08a000e7aefc23d4a18aa5ff4508b3facd0730924eb69a1efeb202d49bbcac8e354cf9804224e505f71d70.ae20abcc29a8223f912cbadce05156b4', 'luhan teste de convite', 'luhanconvite@gmail.com', '4969be6b-eb94-40f4-a04e-e92057d72cd7', 'membro', '{}', true, '2026-04-24 06:18:26.433113', NULL),
  ('ec152cc6-112f-47be-a82f-c0cb0d81cd80', 'Luhan11', '62ab79c14d5f41c84422e9940f9ac444bc0d2d19062c8e25de2627b98dba5ffbc0123fca175b1b272c5a55afafa3b3e7d1c00cc45865fb4e2fdf35234a1c1d33.b4e2510f33da61b1ae8268e5591b15aa', 'Luhan Teste de Cadastro', 'luhanguilherme2@gmail.com', '246ddb19-2ad5-4015-af01-f62943f0b177', 'user', '{}', true, '2026-04-27 23:37:42.277268', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── anuncios ─────────────────────────────────────────────────────────────────
INSERT INTO public.anuncios (id, membro_id, titulo, descricao, link, imagem_directus_id, data_inicio, data_fim, ativo, created_at) VALUES
  ('2bd6b100-dae0-4c1c-b875-dd8dc2dd8b16', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Titulo', 'Descricao', 'elevenmind.com.br', '904ee3e1-aad4-4757-8c6c-aa4ac8d60e43', '2026-04-16', '2026-04-30', false, '2026-04-22 11:40:58.802322'),
  ('d2ea8a94-a446-4331-8c8e-74c1917f4caa', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'a', NULL, 'elevenmind.com.br', 'aa76d337-877e-4866-ac24-db885a438ac2', '2026-04-16', '2026-04-30', false, '2026-04-22 12:06:06.461371'),
  ('24d237ba-ed20-4f1a-ad4a-6c78b4dd5204', '06196cc4-b506-4fa0-b3eb-a74576d5b059', '', NULL, 'elevenmind.com.br', 'c45f0bbb-0756-49be-9e72-ec9012e66172', '2026-04-16', '2026-04-30', false, '2026-04-22 12:32:42.459409'),
  ('246839d8-bc30-4f39-bcb2-492fb1aa1425', '06196cc4-b506-4fa0-b3eb-a74576d5b059', '', NULL, 'elevenmind.com', '427c1bb9-88df-4eea-89ce-4f663f2fa964', '2026-04-16', '2026-04-30', true, '2026-04-23 07:40:14.974422')
ON CONFLICT (id) DO NOTHING;

-- ─── aura_avaliacoes ──────────────────────────────────────────────────────────
INSERT INTO public.aura_avaliacoes (id, avaliador_membro_id, avaliado_membro_id, palavras, created_at) VALUES
  (1, '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'fbf45997-9940-4386-a1f3-77407a22dee7', '{Colaboração,Empatia,Confiança}', '2026-04-28 00:53:12.668287')
ON CONFLICT (id) DO NOTHING;

SELECT setval('public.aura_avaliacoes_id_seq', (SELECT COALESCE(MAX(id), 1) FROM public.aura_avaliacoes), true);

-- ─── convites_link ────────────────────────────────────────────────────────────
INSERT INTO public.convites_link (id, token, gerador_user_id, gerador_membro_id, gerador_nome, comunidade_id, comunidade_nome, status, usado_por_user_id, criado_em, expires_at, usado_em) VALUES
  ('c86a2c2c-0303-4ceb-ab58-e10d9b52f90a', 'cd5af1bc-225e-498a-9af7-372404a48ef6', '98d4ed18-35e9-426b-a523-bc559f3eaf9a', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Barão do Império Chácaras de Lazer SPE Ltda', '4', 'BUILT Brasil | Belo Horizonte | Comunidade A01', 'usado', '16689234-bce7-49fd-8893-443aefac6a07', '2026-04-24 06:15:10.843137', '2026-05-24 06:15:10.841', '2026-04-24 06:18:26.441'),
  ('914ad26e-c7ac-4fb1-a664-1a13e42eb475', 'bbcb2e8b-258a-4dff-bf04-1c4c3d1c4d0c', '98d4ed18-35e9-426b-a523-bc559f3eaf9a', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Barão do Império Chácaras de Lazer SPE Ltda', '4', 'BUILT Brasil | Belo Horizonte | Comunidade A01', 'expirado', NULL, '2026-04-24 07:05:50.886203', '2026-04-25 07:05:50.884', NULL),
  ('dd3118a9-d217-4a55-8474-41bf6ab64a82', '0c8748ca-d7f8-454c-bb54-ca4a1633a27c', '98d4ed18-35e9-426b-a523-bc559f3eaf9a', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Barão do Império Chácaras de Lazer SPE Ltda', '4', 'BUILT Brasil | Belo Horizonte | Comunidade A01', 'usado', 'ec152cc6-112f-47be-a82f-c0cb0d81cd80', '2026-04-27 23:35:22.66794', '2026-05-27 23:35:22.666', '2026-04-27 23:37:42.282'),
  ('4871076a-7beb-4ed7-bf8a-a8e3565a1b9b', '600380af-bedb-4f48-b30c-72e719034562', '98d4ed18-35e9-426b-a523-bc559f3eaf9a', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Barão do Império Chácaras de Lazer SPE Ltda', '4', 'BUILT Brasil | Belo Horizonte | Comunidade A01', 'expirado', NULL, '2026-04-24 07:05:49.565799', '2026-04-25 07:05:49.565', NULL),
  ('bc62a929-47d3-4d71-adb9-729adb823441', '84690c39-4617-4e08-ac01-fd05b6b8bfc4', '98d4ed18-35e9-426b-a523-bc559f3eaf9a', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'Barão do Império Chácaras de Lazer SPE Ltda', '4', 'BUILT Brasil | Belo Horizonte | Comunidade A01', 'expirado', NULL, '2026-04-24 07:05:44.400906', '2026-04-25 07:05:44.399', NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── convites_comunidade ──────────────────────────────────────────────────────
INSERT INTO public.convites_comunidade (id, token, comunidade_id, candidato_membro_id, candidato_nome, candidato_email, invitador_membro_id, status, dados_contratuais, criado_em, atualizado_em, expires_at, tipo, termos_aceitos_em, solicitacao_acesso_em, aura_invitador_avaliada_em, avaliacao_token, lembrete_24h_em, lembrete_48h_em, lembrete_72h_em) VALUES
  ('889a0699-74da-4baf-b182-52254cc1f753', '39529ca3-006e-453b-8dcb-d299404d205f', '4', 'd3fee9a6-d56b-4a7c-a73f-7989a9114cb9', 'Juliana Ramos', 'juliana@3mconsorcios.com.br', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:07:55.25577', '2026-04-20 06:07:55.25577', '2026-04-27 06:07:55.246', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('059451e1-f184-4cb8-a94e-94ca48a68263', '423b349f-6523-4d7a-bef4-12f4b30d4185', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'luhan1@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:32:17.760925', '2026-04-20 06:32:17.760925', '2026-04-27 06:32:17.751', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('9cf1041d-88fe-4a1d-9a2e-a2c248140c15', 'e5204a65-bf11-4d9b-b802-2757a08e2802', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:32:46.563082', '2026-04-20 06:32:46.563082', '2026-04-27 06:32:46.561', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('b30cebe9-4ae9-470c-b8a7-d8b0778d03c6', '687bd577-5941-4c5e-9d95-577bcb8114a1', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:33:06.85021', '2026-04-20 06:33:06.85021', '2026-04-27 06:33:06.84', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('bb64bd09-6cbf-4201-9515-c42d9d7ca44c', '3c2137db-79d8-44bd-8499-d6b56e537391', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:33:32.170011', '2026-04-20 06:33:32.170011', '2026-04-27 06:33:32.159', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('e79af82c-7aa2-467c-b384-e620dad8f0f7', 'cce557f1-9813-4bb7-8438-cbad7b6638cd', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:36:18.500807', '2026-04-20 06:36:18.500807', '2026-04-27 06:36:18.5', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('493ccc14-4d1e-4c16-a8bb-9b935ab972c9', 'd7a258ae-e441-4a50-8553-aa723d91fdd0', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 06:38:06.347657', '2026-04-20 06:38:06.347657', '2026-04-27 06:38:06.345', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('20b1f69e-8b69-4e45-b895-99bfe47b33e7', '1b999959-d273-40a1-8177-90af69e3fcbc', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 11:15:41.996253', '2026-04-20 11:15:41.996253', '2026-04-27 11:15:41.994', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('8ecb92b6-2ec3-4a0b-9aef-1df2624ae165', '2f470d1c-e345-4bd2-b3e4-45af248d8907', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 12:00:40.797257', '2026-04-20 12:00:40.797257', '2026-04-27 12:00:40.786', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('8541e710-5e66-482f-b3d6-c1bc9363d1e1', '49d47cca-5eb4-4602-a106-bcbae575cbbb', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-20 12:01:21.175845', '2026-04-20 12:01:21.175845', '2026-04-27 12:01:21.174', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('108d51c0-a5f7-40f7-9450-27439031a195', '3666d30b-9260-4f87-8663-f86acb57540e', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-21 23:55:11.915584', '2026-04-21 23:55:11.915584', '2026-04-28 23:55:11.905', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('49b3d0d0-69b6-485f-ae2f-9545d32005c1', 'f636d52d-4963-4870-b26a-38f9e0153954', '4', 'fbf45997-9940-4386-a1f3-77407a22dee7', 'LuhanTeste', 'watanabeluhan@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'convidado', NULL, '2026-04-22 00:00:11.736521', '2026-04-22 00:00:11.736521', '2026-04-29 00:00:11.734', 'completo', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('4202c23b-5d69-4cb2-8821-d4f6f3cf9774', '97258fd2-96d4-4f05-a69a-918d56703d28', '4', '4969be6b-eb94-40f4-a04e-e92057d72cd7', 'luhan teste de convite', 'luhanconvite@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'vitrine_ativo', NULL, '2026-04-24 06:18:26.449755', '2026-04-24 06:27:43.336', NULL, 'vitrine', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('5295ae5d-57ea-49b9-8eea-1e371cc994f4', '4b7f2db9-8ec1-4c07-905d-ae8b74e6b11c', '4', '246ddb19-2ad5-4015-af01-f62943f0b177', 'Luhan Teste de Cadastro', 'luhanguilherme2@gmail.com', '06196cc4-b506-4fa0-b3eb-a74576d5b059', 'candidato', NULL, '2026-04-27 23:37:42.286256', '2026-04-27 23:37:42.286256', NULL, 'vitrine', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ─── nucleo_tecnico_docs ──────────────────────────────────────────────────────
INSERT INTO public.nucleo_tecnico_docs (id, bia_id, alianca_tipo, tipo_documento, descricao, membro_responsavel, arquivo_ids, created_at) VALUES
  ('4a69125d-a95d-4201-ad41-e918dade2915', 'a9011ff0-74d0-4ac3-99a6-dfdddc528f66', 'projetos', 'Proposta técnica / SOW (escopo, entregáveis, prazos, critérios de aceite)', 'Teste', NULL, '["dddf7207-b09a-4c16-b44d-b1e3530601b5"]', '2026-04-10 01:19:05.206234')
ON CONFLICT (id) DO NOTHING;
