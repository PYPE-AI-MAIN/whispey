# 🏠 Self-hosting Guide

Deploy Whispey on your own infrastructure for complete data control and privacy.

## 📋 Prerequisites

Before self-hosting, ensure you have:

- **Node.js 18+** and **npm** installed
- **PostgreSQL 14+** database (or Supabase account)
- **Clerk.dev** account for authentication
- **Domain name** (optional but recommended)
- **SSL certificate** for production

## 🚀 Quick Deployment

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/PYPE-AI-MAIN/whispey
cd whispey

# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local

# Start with Docker Compose
docker-compose up -d
```

### Option 2: Manual Setup

```bash
# Clone the repository
git clone https://github.com/PYPE-AI-MAIN/whispey
cd whispey

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
```

## 🔧 Environment Configuration

Edit `.env.local` with your configuration:

```env
# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (Client)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase (Server - optional if needed)
SUPABASE_SERVICE_ROLE_KEY=

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SIGNING_SECRET=

# OpenAI (for transcript field extraction)
OPENAI_API_KEY=
# Optionally override model used by transcript processor
# OPENAI_MODEL=gpt-4o

# VAPI encryption (used for securing Vapi credentials)
VAPI_MASTER_KEY=

# Optional: Public API base URL
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Optional: Analytics / Telemetry
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional: JWT for SSO validation endpoints
JWT_SECRET=

# Optional: AWS (used by audio routes if you enable S3 storage)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=
```

## 🗄️ Database Setup

### Option 1: Supabase (Recommended)

1. **Create Supabase project** at [supabase.com](https://supabase.com)
2. **Run the setup script**:

```bash
# Copy the SQL setup script
cp setup-supabase.sql your-project.sql

# Execute in Supabase SQL editor
# Or use the Supabase CLI:
supabase db push
```

### Option 2: PostgreSQL

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb whispey

# Run setup script
psql -d whispey -f setup-supabase.sql
```

## 🔐 Authentication Setup

### Clerk.dev Configuration

1. **Create Clerk application** at [clerk.dev](https://clerk.dev)
2. **Configure domains** in Clerk dashboard
3. **Set up OAuth providers** (Google, GitHub, etc.)
4. **Copy API keys** to your `.env.local`

### Custom Authentication (Advanced)

```typescript
// lib/auth.ts
import { createClerkClient } from '@clerk/nextjs/server'

export const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
})
```

## 🌐 Domain & SSL Setup

### Production Domain

```bash
# Configure your domain
# Add to your DNS:
# A record: your-domain.com -> your-server-ip
# CNAME: www.your-domain.com -> your-domain.com

# Update environment
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### SSL Certificate

```bash
# Install Certbot
sudo apt-get install certbot

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🐳 Docker Deployment

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.local
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      POSTGRES_DB: whispey
      POSTGRES_USER: whispey
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Build and Deploy

```bash
# Build the image
docker build -t whispey .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f
```

## 🚀 Production Deployment

### Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables (repeat for each)
vercel env add NEXT_PUBLIC_APP_URL
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add CLERK_WEBHOOK_SIGNING_SECRET
vercel env add OPENAI_API_KEY
vercel env add VAPI_MASTER_KEY
vercel env add NEXT_PUBLIC_POSTHOG_KEY
vercel env add NEXT_PUBLIC_POSTHOG_HOST
vercel env add NEXT_PUBLIC_API_URL
vercel env add JWT_SECRET
vercel env add AWS_ACCESS_KEY_ID
vercel env add AWS_SECRET_ACCESS_KEY
vercel env add AWS_REGION
vercel env add AWS_S3_BUCKET
```

### Manual Server Deployment

```bash
# Install PM2
npm install -g pm2

# Build the application
npm run build

# Start with PM2
pm2 start npm --name "whispey" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🔧 Customization

### Branding

```typescript
// lib/config.ts
export const config = {
  appName: "Your Company Analytics",
  logo: "/your-logo.png",
  primaryColor: "#3B82F6",
  // ... other branding options
}
```

### Custom API Endpoints

```typescript
// pages/api/custom-endpoint.ts
import { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Your custom API logic
  res.status(200).json({ message: 'Custom endpoint' })
}
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check application health
curl https://your-domain.com/api/health

# Monitor logs
docker-compose logs -f app
pm2 logs whispey
```

### Database Maintenance

```sql
-- Regular cleanup (run monthly)
DELETE FROM logs WHERE created_at < NOW() - INTERVAL '90 days';
VACUUM ANALYZE;
```

### Backup Strategy

```bash
# Database backup
pg_dump whispey > backup_$(date +%Y%m%d).sql

# File backup
tar -czf backup_$(date +%Y%m%d).tar.gz /path/to/whispey
```

## 🔒 Security Considerations

### Environment Security

```bash
# Secure environment file
chmod 600 .env.local

# Use secrets management
# For Docker: docker secrets
# For Kubernetes: Kubernetes secrets
```

### Network Security

```bash
# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### SSL/TLS Configuration

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🆘 Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Check database status
sudo systemctl status postgresql

# Test connection
psql -h localhost -U whispey -d whispey
```

**Authentication Issues**
```bash
# Check Clerk configuration
curl -H "Authorization: Bearer $CLERK_SECRET_KEY" \
  https://api.clerk.dev/v1/users
```

**Build Errors**
```bash
# Clear cache
rm -rf .next
npm run build

# Check Node.js version
node --version  # Should be 18+
```

## 📚 Related Documentation

- [🚀 Getting Started Guide](getting-started.md)
- [🔧 SDK Reference](sdk-reference.md)
- [📊 Dashboard Tutorial](dashboard-guide.md)

## 💬 Support

- **💬 Discord**: [Join our community](https://discord.gg/r2eMeAp6)
- **📧 Email**: deepesh@pypeai.com
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/whispey/issues)

---

**🎉 Your self-hosted Whispey instance is ready!** Visit your domain to start using the analytics platform. 