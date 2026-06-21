# =============================================
# Stage 1: Base — shared Alpine + pnpm
# =============================================
FROM docker.io/node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm && \
    apk add --no-cache libc6-compat

# =============================================
# Stage 2: Dependencies — install once, cleanly
# =============================================
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

# 1. ติดตั้งแบบไม่รัน scripts ก่อน
RUN pnpm install --frozen-lockfile --ignore-scripts

# 2. Approve เฉพาะ package ที่ต้องรัน build scripts
RUN pnpm approve-builds @prisma/engines prisma sharp unrs-resolver

# 3. Rebuild เพื่อรัน scripts ของตัวที่ถูก approve แล้ว
RUN pnpm rebuild

# =============================================
# Stage 3: Build — compile Next.js
# =============================================
FROM base AS builder
WORKDIR /app

# 1) Copy dependencies และ package.json (จำเป็นสำหรับ prisma)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# 2) Copy prisma schema แล้ว generate client
COPY prisma ./prisma
RUN pnpm prisma generate

# 3) ตั้ง build-time env ก่อน copy source
ARG NEXT_PUBLIC_BETTER_AUTH_URL
ENV NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL

# BETTER_AUTH_SECRET ไม่ควร bake ใน image
ENV BETTER_AUTH_SECRET="build-time-placeholder"
ENV BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV STANDALONE_BUILD=true

# 4) Copy source code
COPY . .

# 5) Build Next.js
RUN pnpm build

# =============================================
# Stage 4: Runner — minimal production image
# =============================================
FROM docker.io/node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# ติดตั้ง Prisma CLI สำหรับรัน sync schema ใน production
RUN npm install -g prisma@7.5.0

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone output: เฉพาะไฟล์ที่จำเป็น
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma: copy schema + custom generated client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/app/generated/prisma ./app/generated/prisma

# Copy entrypoint (Ensure LF line endings)
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["/bin/sh", "/app/entrypoint.sh"]