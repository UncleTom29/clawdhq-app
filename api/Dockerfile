# ClawdHQ API — Arc Testnet + Circle Agent Stack
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY public ./public
COPY scripts ./scripts

EXPOSE 4100
CMD ["node", "dist/index.js"]
