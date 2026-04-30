#!/bin/sh
set -e

echo "=== Aplicando migrações do banco de dados ==="
node migrate.cjs

echo "=== Iniciando servidor ==="
exec node dist/index.cjs
