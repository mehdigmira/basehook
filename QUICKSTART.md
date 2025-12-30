# Basehook Quick Start

## Option 1: Docker Compose (5 minutes)

Perfect for: Development, self-hosting, full control

```bash
# 1. Clone and enter directory
git clone https://github.com/mehdigmira/basehook.git
cd basehook

# 2. Start everything
docker-compose up -d

# 3. Verify it's running
curl http://localhost:8000/api/webhooks

# 4. View logs (optional)
docker-compose logs -f app

# 5. Stop when done
docker-compose down
```

**What you get:**
- API running on `http://localhost:8000`
- PostgreSQL database with persistent storage
- Auto-restart on crashes

**Common commands:**
```bash
# Restart
docker-compose restart

# View app logs
docker-compose logs app

# View database logs
docker-compose logs db

# Access database
docker exec -it basehook-db psql -U basehook

# Clean everything (including data!)
docker-compose down -v
```

---

## Option 2: Railway (10 minutes)

Perfect for: Production, no server management, automatic HTTPS

**Step 1: Deploy the app**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/mehdigmira/basehook)

Click button → Wait for build (~2 minutes)

**Step 2: Add database**

1. In Railway dashboard, click "New"
2. Select "Database" → "Add PostgreSQL"
3. Wait ~30 seconds for provisioning

**Step 3: Verify**

Your app URL: `https://your-app.railway.app`

```bash
# Test it
curl https://your-app.railway.app/api/webhooks
```

**What you get:**
- Automatic HTTPS with custom domain support
- Auto-scaling and monitoring
- Managed PostgreSQL database
- Built-in CI/CD (auto-deploy on git push)

---

## Next Steps

After deploying:

1. **Create a webhook:**
   ```bash
   curl -X POST http://localhost:8000/api/webhooks \
     -H "Content-Type: application/json" \
     -d '{
       "name": "my-webhook",
       "thread_id_path": ["event", "id"],
       "revision_number_path": ["timestamp"],
       "hmac_enabled": false
     }'
   ```

2. **Send data to your webhook:**
   ```bash
   curl -X POST http://localhost:8000/my-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": {"id": "thread-1"},
       "timestamp": 1234567890,
       "data": "Hello World"
     }'
   ```

3. **Query thread updates:**
   ```bash
   curl -X POST http://localhost:8000/api/thread-updates \
     -H "Content-Type: application/json" \
     -d '{"page": 1, "per_page": 10}'
   ```

4. **Access the frontend (if deployed):**
   - Navigate to `/` for the webhook management UI
   - View at `/home` for thread updates dashboard

For more details, see [DEPLOYMENT.md](DEPLOYMENT.md)
