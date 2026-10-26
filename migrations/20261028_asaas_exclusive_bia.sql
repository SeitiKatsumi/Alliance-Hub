-- Não redistribui contas nem dinheiro. Vínculos legados compartilhados exigem resolução explícita.
CREATE UNIQUE INDEX IF NOT EXISTS bia_accounts_exclusive_account ON asaas_sandbox.bia_accounts(account_id);
CREATE UNIQUE INDEX IF NOT EXISTS bia_accounts_exclusive_account ON asaas_production.bia_accounts(account_id);
