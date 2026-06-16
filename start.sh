#!/bin/sh
set -e

echo "=== Aplicando migrações do banco de dados ==="
node migrate.cjs

if [ "$NODE_ENV" = "production" ]; then
  # CapRover encaminha HTTP para a porta interna 80 por padrao.
  # Forcamos aqui para evitar que uma variavel PORT antiga no painel cause 502.
  export PORT=80
fi

echo "=== Iniciando servidor ==="
echo "Servidor escutando na porta ${PORT:-5000}"
exec node dist/index.cjs
