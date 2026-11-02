-- Temporary, owner-scoped receipt analysis. Existing financial records are unchanged.
CREATE TABLE IF NOT EXISTS fluxo_comprovante_analises (
  id uuid PRIMARY KEY, bia_id text NOT NULL, owner_id text NOT NULL, sha256 text NOT NULL,
  filename text NOT NULL, mime text NOT NULL, file_base64 text, file_id text,
  facts jsonb NOT NULL, candidates jsonb NOT NULL, flow_id text, automatic boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  attached_at timestamptz, UNIQUE(bia_id,sha256)
);
