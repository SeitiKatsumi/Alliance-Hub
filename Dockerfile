FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# CAPROVER_GIT_COMMIT_SHA muda a cada deploy — invalida o cache das layers abaixo
ARG CAPROVER_GIT_COMMIT_SHA=unknown
ENV BUILD_SHA=${CAPROVER_GIT_COMMIT_SHA}

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY migrate.cjs ./migrate.cjs
COPY start.sh ./start.sh

# connect-pg-simple é bundlado pelo esbuild — o __dirname aponta para dist/
# então precisamos do table.sql nesse diretório para criar a tabela de sessões
RUN cp node_modules/connect-pg-simple/table.sql dist/table.sql

RUN chmod +x start.sh

ENV NODE_ENV=production
EXPOSE 5000

CMD ["./start.sh"]
