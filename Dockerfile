FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --legacy-peer-deps

# Copy application files
COPY . .

# Run postinstall
RUN npm run postinstall

ENV NODE_ENV=production

# Build-time-only placeholders so Next's "collect page data" step doesn't crash on
# eager client creation. Real values are injected at container runtime via --env-file.
ARG SUPABASE_URL=https://build-placeholder.supabase.co
ARG SUPABASE_SERVICE_ROLE_KEY=build-placeholder-key
ENV SUPABASE_URL=${SUPABASE_URL}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# Build the production bundle
RUN npm run build

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000

CMD ["npm", "run", "start"]
