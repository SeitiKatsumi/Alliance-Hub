CREATE TABLE "alianca_docs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modulo" text,
	"bia_id" text,
	"alianca_tipo" text,
	"tipo_documento" text,
	"descricao" text,
	"membro_responsavel" text,
	"arquivo_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "anuncios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membro_id" varchar NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"descricao" text,
	"link" varchar(500),
	"imagem_directus_id" varchar,
	"data_inicio" date NOT NULL,
	"data_fim" date NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aura_avaliacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"avaliador_membro_id" text NOT NULL,
	"avaliado_membro_id" text NOT NULL,
	"palavras" text[] NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "aura_avaliacoes_avaliador_avaliado_uniq" UNIQUE("avaliador_membro_id","avaliado_membro_id")
);
--> statement-breakpoint
CREATE TABLE "bia_aprovacoes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bia_id" text NOT NULL,
	"bia_nome" text,
	"status" text DEFAULT 'pendente' NOT NULL,
	"solicitante_membro_id" text NOT NULL,
	"solicitante_nome" text,
	"solicitante_email" text,
	"aliado_built_membro_id" text,
	"aliado_built_email" text,
	"aliado_built_nome" text,
	"comunidade_id" text,
	"comunidade_nome" text,
	"motivo_rejeicao" text,
	"criado_em" timestamp DEFAULT now(),
	"revisado_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "bia_info_comercial" (
	"id" serial PRIMARY KEY NOT NULL,
	"bia_id" text NOT NULL,
	"razao_social" text,
	"cnpj" text,
	"nome_fantasia" text,
	"inscricao_estadual" text,
	"banco" text,
	"agencia" text,
	"conta" text,
	"tipo_conta" text,
	"titular_conta" text,
	"chave_pix" text,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "bia_info_comercial_bia_id_unique" UNIQUE("bia_id")
);
--> statement-breakpoint
CREATE TABLE "bias_projetos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_bia" text NOT NULL,
	"objetivo_alianca" text,
	"observacoes" text,
	"localizacao" text,
	"autor_bia" text,
	"aliado_built" text,
	"diretor_alianca" text,
	"diretor_execucao" text,
	"diretor_comercial" text,
	"diretor_capital" text,
	"valor_origem" numeric,
	"divisor_multiplicador" numeric,
	"perc_autor_opa" numeric,
	"cpp_autor_opa" numeric,
	"perc_aliado_built" numeric,
	"cpp_aliado_built" numeric,
	"perc_built" numeric,
	"cpp_built" numeric,
	"perc_dir_tecnico" numeric,
	"cpp_dir_tecnico" numeric,
	"perc_dir_obras" numeric,
	"cpp_dir_obras" numeric,
	"perc_dir_comercial" numeric,
	"cpp_dir_comercial" numeric,
	"perc_dir_capital" numeric,
	"cpp_dir_capital" numeric,
	"custo_origem_bia" numeric,
	"custo_final_previsto" numeric,
	"valor_realizado_venda" numeric,
	"comissao_prevista_corretor" numeric,
	"ir_previsto" numeric,
	"resultado_liquido" numeric,
	"lucro_previsto" numeric,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text
);
--> statement-breakpoint
CREATE TABLE "convites_comunidade" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar DEFAULT gen_random_uuid() NOT NULL,
	"comunidade_id" text NOT NULL,
	"candidato_membro_id" text NOT NULL,
	"candidato_nome" text,
	"candidato_email" text,
	"invitador_membro_id" text,
	"status" text DEFAULT 'convidado' NOT NULL,
	"tipo" text DEFAULT 'completo' NOT NULL,
	"dados_contratuais" jsonb,
	"expires_at" timestamp,
	"termos_aceitos_em" timestamp,
	"solicitacao_acesso_em" timestamp,
	"aura_invitador_avaliada_em" timestamp,
	"avaliacao_token" varchar,
	"lembrete_24h_em" timestamp,
	"lembrete_48h_em" timestamp,
	"lembrete_72h_em" timestamp,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now(),
	CONSTRAINT "convites_comunidade_token_unique" UNIQUE("token"),
	CONSTRAINT "convites_comunidade_avaliacao_token_unique" UNIQUE("avaliacao_token")
);
--> statement-breakpoint
CREATE TABLE "convites_link" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar DEFAULT gen_random_uuid() NOT NULL,
	"gerador_user_id" varchar NOT NULL,
	"gerador_membro_id" text,
	"gerador_nome" text,
	"comunidade_id" text,
	"comunidade_nome" text,
	"status" text DEFAULT 'ativo' NOT NULL,
	"usado_por_user_id" varchar,
	"criado_em" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"usado_em" timestamp,
	CONSTRAINT "convites_link_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "fluxo_caixa" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bia_id" text,
	"tipo" text NOT NULL,
	"valor" numeric NOT NULL,
	"data" date,
	"descricao" text,
	"membro_responsavel_id" text,
	"categoria_id" text,
	"tipo_cpp_id" text,
	"favorecido_id" text,
	"anexos" text[],
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membros" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"telefone" text,
	"whatsapp" text,
	"cidade" text,
	"estado" text,
	"empresa" text,
	"cargo" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "nucleo_tecnico_docs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bia_id" text,
	"alianca_tipo" text,
	"tipo_documento" text,
	"descricao" text,
	"membro_responsavel" text,
	"arquivo_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "opa_interesses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opa_id" text NOT NULL,
	"user_id" text NOT NULL,
	"membro_id" text,
	"membro_nome" text,
	"mensagem" text,
	"multiplicador" text,
	"criado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oportunidades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome_oportunidade" text NOT NULL,
	"tipo" text,
	"bia_id" text,
	"valor_origem_opa" numeric,
	"objetivo_alianca" text,
	"nucleo_alianca" text,
	"pais" text DEFAULT 'Brasil',
	"descricao" text,
	"perfil_aliado" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tipos_cpp" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text
);
--> statement-breakpoint
CREATE TABLE "transferencias_cotas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bia_id" varchar NOT NULL,
	"membro_origem_id" varchar NOT NULL,
	"membro_destino_id" varchar NOT NULL,
	"valor_total" numeric,
	"percentual_transferencia" numeric(5, 2),
	"status" text DEFAULT 'pendente' NOT NULL,
	"solicitado_por" varchar,
	"observacoes" text,
	"motivo_rejeicao" text,
	"criado_em" timestamp DEFAULT now(),
	"atualizado_em" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"google_id" text,
	"membro_directus_id" text,
	"role" text DEFAULT 'user' NOT NULL,
	"permissions" jsonb DEFAULT '{"oportunidades":"view","bias":"view","calculadora":"none","fluxo_caixa":"none","membros":"view","aura":"view","painel":"view","admin":"none"}'::jsonb NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
