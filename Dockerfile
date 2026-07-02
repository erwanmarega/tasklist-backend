FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY tsconfig.json ./
COPY src ./src/

RUN npm run build
RUN npx prisma generate


FROM node:22-alpine AS production

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/server.js"]
