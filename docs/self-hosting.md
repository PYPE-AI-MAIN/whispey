# 🏠 Self-hosting Guide

Deploy Whispey on your own infrastructure in 3 simple steps!

## 🚀 Quick Setup (5 minutes)

### Step 1: Clone & Install
```bash
git clone https://github.com/PYPE-AI-MAIN/whispey
cd whispey
npm install
```

### Step 2: Setup Database

1. **Go to your Supabase project** → **Settings** → **Database**
2. **Find your project reference ID** in the "Connection string" section (it looks like: `db.xxxxxxxxxxxxx.supabase.co`)
3. **Copy your project reference ID** (the part between `db.` and `.supabase.co`)
4. **Install psql** (PostgreSQL client):
   ```bash
   # macOS
   brew install postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```
5. **Run the setup script** (replace `YOUR_PROJECT_REF` with your actual project reference ID):
   ```bash
   psql -h db.YOUR_PROJECT_REF.supabase.co -p 5432 -U postgres -d postgres -f setup-supabase.sql
   ```
   **Example**: If your project ref is `abc123def456`, use:
   ```bash
   psql -h db.abc123def456.supabase.co -p 5432 -U postgres -d postgres -f setup-supabase.sql
   ```
6. **Enter your database password** when prompted ✅

**Option C: Manual (if you prefer)**
1. **Go to SQL Editor** in your Supabase dashboard
2. **Copy & paste** the entire `setup-supabase.sql` file
3. **Click Run** ✅

### Step 3: Configure & Run
```bash
# Copy environment template
cp .env.example .env.local

# Edit with your Supabase details
nano .env.local

# Start the app
npm run dev
```

🎉 **Done!** Your Whispey is running at `http://localhost:3000`

## 🔧 Environment Configuration

Edit `.env.local` with your Supabase details:

```env
# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (Required - get from your Supabase project settings)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication (Required - get from clerk.dev)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# OpenAI (Required for field extraction)
OPENAI_API_KEY=sk-...

# VAPI encryption (Required)
VAPI_MASTER_KEY=your-secret-key

# Optional: Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## 📊 Using Whispey SDK

Once your Whispey is running, use it in your Python code:

```python
import os
from whispey import LivekitObserve

# Initialize Whispey
whispey = LivekitObserve(
    host_url="http://localhost:3000/api/logs/call-logs",
    agent_id="your-agent-id",  # Get this from your Whispey dashboard
    apikey=os.getenv("WHISPEY_API_KEY")  # Your project API key
)

# Start observing your LiveKit session
whispey.observe_session(session)
```

### Getting Your API Key:
1. **Go to your Whispey dashboard** at `http://localhost:3000`
2. **Create a project** and copy the API key
3. **Create an agent** and copy the agent ID
4. **Use them in your code** ✅

### Upgrading Your Agent Code:
If you're updating an existing agent, make sure to upgrade the Whispey SDK:

```bash
# Upgrade to the latest version
pip install --upgrade whispey

# Or install the latest development version
pip install --upgrade git+https://github.com/PYPE-AI-MAIN/whispey.git
```

Then update your agent code to use the new endpoint:
```python
# Update your host_url to point to your self-hosted instance
whispey = LivekitObserve(
    host_url="http://localhost:3000/api/logs/call-logs",  # Your self-hosted URL
    agent_id="your-agent-id",
    apikey=os.getenv("WHISPEY_API_KEY")
)
```


## Production Deployment

### Deploy to Vercel (Recommended for Beginners)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

### Deploy to Your Own Server with Custom Domain

#### 1. Server Setup
```bash
# Update your server
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

#### 2. Deploy Whispey
```bash
# Clone and setup
git clone https://github.com/PYPE-AI-MAIN/whispey
cd whispey
npm install

# Build for production
npm run build

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'whispey',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/whispey',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

# Create logs directory
mkdir -p logs

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 3. Configure Nginx Reverse Proxy
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/whispey
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/whispey /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 4. SSL Certificate with Let's Encrypt
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

#### 5. Update Environment Variables
```bash
# Update .env.local for production
nano .env.local
```

```env
# Production App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Supabase (your production project)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication (update Clerk domains)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-...

# VAPI encryption
VAPI_MASTER_KEY=your-secret-key
```

#### 6. Configure Clerk for Production
1. **Go to Clerk Dashboard** → **Domains**
2. **Add your domain**: `your-domain.com`
3. **Update redirect URLs** to use `https://your-domain.com`
4. **Switch to production keys** in your environment

#### 7. Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### Docker Deployment (Alternative)
```bash
# Create Dockerfile
cat > Dockerfile << EOF
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << EOF
version: '3.8'
services:
  whispey:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
EOF

# Build and run
docker-compose up -d
```

### Monitoring & Maintenance
```bash
# Check PM2 status
pm2 status
pm2 logs whispey

# Restart application
pm2 restart whispey

# Monitor system resources
pm2 monit

# Update application
git pull origin main
npm install
npm run build
pm2 restart whispey
```

## 🆘 Troubleshooting

**App won't start?**
- Check your `.env.local` file has all required variables
- Make sure Supabase project is created and SQL is run
- Check Node.js version: `node --version` (should be 18+)

**Database errors?**
- Verify Supabase URL and keys in `.env.local`
- Check if `setup-supabase.sql` was run successfully
- Test connection in Supabase dashboard

**Authentication issues?**
- Verify Clerk keys in `.env.local`
- Check if domain is configured in Clerk dashboard

## 🎯 That's It!

Your Whispey is now running! 🎉

- **Dashboard**: `http://localhost:3000`
- **API Endpoint**: `http://localhost:3000/api/logs/call-logs`
- **SDK Ready**: Use the Python code above to start collecting data

## 💬 Need Help?

- **📧 Email**: deepesh@pypeai.com
- **🐛 Issues**: [GitHub Issues](https://github.com/PYPE-AI-MAIN/whispey/issues)

---

**Happy Observing!** 🚀 
