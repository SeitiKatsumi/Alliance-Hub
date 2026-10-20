# Publicacao automatica no CapRover

O repositorio publica automaticamente no CapRover depois de cada `push` na branch `main`. Antes da publicacao, o GitHub executa o contrato da plataforma, o typecheck, todos os testes e o build. Se alguma verificacao falhar, a versao em producao nao e substituida.

## Configuracao unica

1. No CapRover, abra o aplicativo da BUILT e acesse **Deployment**.
2. Em **App Token**, habilite e copie o token exclusivo desse aplicativo. Nao use a senha do painel e nao grave o token no repositorio.
3. No GitHub, abra **Settings > Environments** e crie o ambiente `production`.
4. Dentro desse ambiente, cadastre estes segredos:

   - `CAPROVER_SERVER`: URL HTTPS do servidor, por exemplo `https://captain.exemplo.com`.
   - `CAPROVER_APP`: nome exato do aplicativo no CapRover.
   - `CAPROVER_APP_TOKEN`: token do aplicativo copiado no passo 2.

5. Confirme em **Settings > Actions > General** que GitHub Actions esta habilitado.
6. Envie este workflow para a `main`. A aba **Actions** mostrara primeiro a validacao e depois a publicacao.

Tambem e possivel iniciar a mesma rotina manualmente em **Actions > Validar e publicar no CapRover > Run workflow**.

## Comportamento e seguranca

- Apenas a branch `main` publica em producao.
- Um novo push cancela uma execucao anterior ainda em andamento, evitando publicar versao ultrapassada.
- O job de deploy so inicia depois de `npm run platform:verify` passar.
- O CapRover continua usando o `captain-definition` e o `Dockerfile` existentes.
- O `start.sh` executa as migracoes previstas pela aplicacao antes de iniciar o servidor; por isso, toda migracao nova precisa continuar aditiva e testada.
- Nunca cadastre os segredos como variaveis no codigo, em `.env` versionado ou no proprio arquivo do workflow.

## Diagnostico rapido

- **Configuracao ausente**: um dos tres segredos nao foi cadastrado no ambiente `production`.
- **Unauthorized**: gere novamente o App Token no CapRover e atualize apenas `CAPROVER_APP_TOKEN`.
- **Aplicativo nao encontrado**: confira maiusculas, minusculas e hifens de `CAPROVER_APP`.
- **Falha antes do deploy**: abra o job **Validar aplicacao**; a producao foi preservada.
- **Falha durante o build no CapRover**: consulte os deployment logs do aplicativo e confirme que o servidor tem recursos para executar o `Dockerfile`.

Nao habilite simultaneamente o webhook de deploy automatico nativo do CapRover para o mesmo aplicativo e branch. Isso faria cada push iniciar duas publicacoes.
