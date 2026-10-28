// Additional application guard. Network isolation and a copied database are also mandatory.
export const isolatedStage = () => process.env.BUILT_ISOLATED_STAGE === '1';
export function assertIsolatedStageEnvironment() {
  if (!isolatedStage()) return;
  if (process.env.BUILT_DATA_BACKEND !== 'postgres' || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw new Error('Homologação requer base nativa e segredo de sessão próprio.');
  const forbidden = ['SMTP_PASS','SMTP_USER','DIRECTUS_TOKEN','ASAAS_API_KEY','OPENAI_API_KEY','STRIPE_SECRET_KEY','GOOGLE_CLIENT_SECRET'];
  if (forbidden.some(key => process.env[key])) throw new Error('Homologação não permite credenciais de integrações.');
}
