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
# eager client/config creation. Real values are injected at container runtime via --env-file.
ARG BUILD_PLACEHOLDER=build-placeholder-not-a-real-secret
ENV SUPABASE_URL=https://build-placeholder.supabase.co
ENV SUPABASE_SERVICE_ROLE_KEY=${BUILD_PLACEHOLDER}
ENV VAPI_MASTER_KEY=${BUILD_PLACEHOLDER}
ENV WHISPEY_MASTER_KEY=${BUILD_PLACEHOLDER}

# Real value required — gets baked into the client bundle by Next.js at build time.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
RUN if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then echo "ERROR: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY build-arg is empty"; exit 1; fi
RUN echo "Clerk key prefix: $(echo $NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | cut -c1-8)  length: ${#NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}"

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
