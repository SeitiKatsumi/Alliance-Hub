-- Preferências pessoais; não modifica perfis, permissões, aceites ou assinaturas.
CREATE TABLE IF NOT EXISTS user_platform_preferences (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'pt-BR' CHECK (language IN ('pt-BR', 'en', 'es')),
  email jsonb NOT NULL DEFAULT '{"invites":true,"agenda":true,"bia":true,"opportunities":true,"community":true}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(email) = 'object')
);
