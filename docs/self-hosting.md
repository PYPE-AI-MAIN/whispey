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
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
WHISPEY_API_KEY=your_api_key_for_sdk

# Optional: Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=your_ga_id
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

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
# ... add all required env vars
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

- **💬 Discord**: [Join our community](https://discord.gg/pypeai)
- **📧 Email**: support@whispey.ai
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/whispey/issues)

---

**🎉 Your self-hosted Whispey instance is ready!** Visit your domain to start using the analytics platform. 