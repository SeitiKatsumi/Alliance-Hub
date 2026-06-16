#!/bin/sh
set -e

echo "=== Aplicando migrações do banco de dados ==="
node migrate.cjs

if [ "$NODE_ENV" = "production" ]; then
  # A porta interna da aplicacao precisa bater com "Container HTTP Port" no CapRover.
  # Mantemos 5000 explicito para evitar mismatch com variaveis antigas do painel.
  export PORT=5000
fi

echo "=== Iniciando servidor ==="
echo "Servidor escutando na porta ${PORT:-5000}"
exec node dist/index.cjs
