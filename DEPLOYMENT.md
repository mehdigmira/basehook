# Basehook Deployment Guide

## Deployment Options

Basehook supports two deployment methods:
1. **Docker Compose** - For self-hosting on your own servers
2. **Railway** - For cloud hosting with managed infrastructure

---

## Docker Compose Deployment

### Quick Start

```bash
git clone https://github.com/mehdigmira/basehook.git
cd basehook
docker-compose up -d
```

Your API is now running at `http://localhost:8000`!

### Configuration

Edit `docker-compose.yml` to customize:

```yaml
environment:
  DATABASE_URL: postgresql+asyncpg://basehook:basehook@db:5432/basehook
  # Add other environment variables here
```

### Production Recommendations

1. **Use secrets for passwords:**
   ```yaml
   environment:
     POSTGRES_PASSWORD: ${DB_PASSWORD}  # From .env file
   ```

2. **Add reverse proxy (nginx/traefik)** for HTTPS

3. **Set up backups:**
   ```bash
   docker exec basehook-db pg_dump -U basehook > backup.sql
   ```

4. **Use volumes for persistence** (already configured)

---

## Railway Deployment

This project is configured for easy deployment on [Railway](https://railway.app).

### Prerequisites

1. A Railway account
2. A GitHub repository (optional but recommended)

### Quick Deploy

#### Option 1: Deploy from GitHub

1. Push your code to GitHub
2. Go to [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your basehook repository
5. Railway will automatically detect the configuration files

#### Option 2: Deploy with Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Environment Variables

Set these environment variables in your Railway project:

**Required:**
- `DATABASE_URL` - PostgreSQL connection string (Railway provides this automatically if you add a PostgreSQL service)

**Optional:**
- `PORT` - Port to run the server on (Railway sets this automatically)

### Database Setup

1. In your Railway project dashboard, click "New" → "Database" → "Add PostgreSQL"
2. Railway will automatically set the `DATABASE_URL` environment variable
3. The application will automatically create tables on startup

### Configuration Files

The project includes these Railway configuration files:

- `railway.toml` - Railway-specific configuration
- `nixpacks.toml` - Build and runtime configuration
- `Procfile` - Process definition (backup)

### Post-Deployment

After deployment:

1. Your API will be available at the Railway-provided URL
2. Access the webhook endpoint at: `https://your-app.railway.app/{webhook_name}`
3. View thread updates at: `https://your-app.railway.app/api/thread-updates`

### Health Check

The health check endpoint is configured as: `/api/webhooks`

You can verify your deployment is working:
```bash
curl https://your-app.railway.app/api/webhooks
```

### Viewing Logs

```bash
# Using Railway CLI
railway logs

# Or view in Railway dashboard
```

### Scaling

Railway automatically handles scaling. For production workloads:

1. Go to your service settings
2. Adjust resource limits under "Resources"
3. Enable autoscaling if needed

### Custom Domain

1. Go to service "Settings" → "Domains"
2. Click "Generate Domain" or "Custom Domain"
3. Follow Railway's instructions to configure DNS

## Local Development vs Production

The application uses the `DATABASE_URL` environment variable:

**Local (default):**
```
postgresql+asyncpg://chiefskiss:chiefskiss@localhost:5445/chiefskiss
```

**Production (Railway):**
```
Set by Railway's PostgreSQL service automatically
```

## Troubleshooting

### Build Fails

1. Check that `pyproject.toml` has all required dependencies
2. Verify Python version compatibility (3.10+)
3. Check Railway build logs for specific errors

### Database Connection Issues

1. Ensure PostgreSQL service is added to your Railway project
2. Verify `DATABASE_URL` is set in environment variables
3. Check that the database is in the same region for best performance

### Application Crashes

1. Check logs: `railway logs`
2. Verify all environment variables are set
3. Ensure the `PORT` variable is being used correctly

## Manual Migration

If you need to run migrations or seed data:

```bash
# Connect to Railway shell
railway run bash

# Run seed script (if needed)
psql $DATABASE_URL -f seed_data.sql
```

## Monitoring

Railway provides built-in monitoring:

- CPU usage
- Memory usage
- Network traffic
- Deployment history

Access these in your project dashboard.
