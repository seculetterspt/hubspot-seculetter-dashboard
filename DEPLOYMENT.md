# Deployment Guide: HubSpot Seculetter Dashboard

## Overview

This guide covers deploying the HubSpot Seculetter Dashboard with OAuth authentication to Render or other cloud platforms.

## Prerequisites

- HubSpot account with Private App access
- PostgreSQL database (Render or external)
- Render account (or similar platform)
- Node.js 22+ (for local development)

## Step 1: Set Up HubSpot OAuth

### Create a Private App in HubSpot

1. Go to **HubSpot Settings** → **Integrations** → **Private Apps**
2. Click **Create app**
3. Under **Auth**, add these OAuth scopes:
   - `crm.objects.contacts.read` - To read user identity
   - `oauth` - For OAuth authorization

4. Copy the credentials:
   - **Client ID** → `HUBSPOT_CLIENT_ID`
   - **Client Secret** → `HUBSPOT_CLIENT_SECRET`

### Configure OAuth Redirect URI

In HubSpot Private App settings:
- **Redirect URL**: `https://your-render-domain/auth/hubspot/callback`
  (Example: `https://seculetter-hubspot-api.onrender.com/auth/hubspot/callback`)

## Step 2: Environment Variables

### Required Variables

```env
# OAuth Configuration (REQUIRED)
HUBSPOT_CLIENT_ID=<from HubSpot Private App>
HUBSPOT_CLIENT_SECRET=<from HubSpot Private App>
HUBSPOT_OAUTH_REDIRECT_URI=https://your-domain.com/auth/hubspot/callback

# Session Secret (REQUIRED)
SESSION_SECRET=<generate with: openssl rand -hex 32>

# HubSpot API (REQUIRED for data operations)
HUBSPOT_ACCESS_TOKEN=<HubSpot Private App token>
HUBSPOT_ACCOUNT_ID=<your HubSpot account ID>

# Database (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/database_name

# Server Configuration
PORT=3001
NODE_ENV=production
```

### Optional Variables

```env
# Access Control
ALLOWED_EMAIL_DOMAINS=company.com,partner.com
ALLOWED_EMAILS=user1@company.com,user2@company.com

# URLs
FRONTEND_URL=https://your-frontend-domain.com
APP_BASE_URL=https://your-api-domain.com
```

## Step 3: Deploy to Render

### Backend Service

1. Create a new **Web Service** in Render
2. Connect your GitHub repository
3. Set up the service:
   - **Build Command**: `cd backend && npm install --include=dev && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Port**: `3001`

4. Add environment variables in **Environment** settings

5. Set up PostgreSQL:
   - Create a new PostgreSQL database in Render
   - Copy the connection string to `DATABASE_URL`

### Frontend Service

1. Create a new **Static Site** in Render
2. Connect your GitHub repository
3. Set up the service:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

## Step 4: Initialize Database

After deployment, run migrations:

```bash
# Connect to Render backend instance and run:
npm run db:migrate
```

Or the database tables will be created automatically on first run.

## Step 5: Test Authentication

1. Visit: `https://your-frontend-domain.com`
2. Click "HubSpot로 로그인"
3. You should be redirected to HubSpot OAuth consent screen
4. After approval, you'll be logged in with your email

## Troubleshooting

### OAuth Login Fails

**Issue**: "Failed to initiate HubSpot login"

**Solution**: Check that these environment variables are set:
- `HUBSPOT_CLIENT_ID`
- `HUBSPOT_CLIENT_SECRET`
- `HUBSPOT_OAUTH_REDIRECT_URI` (matches HubSpot Private App setting)

### "Access Denied" After Login

**Issue**: User can log in but gets "access denied" message

**Solution**:
- If using `ALLOWED_EMAIL_DOMAINS`: Ensure user's email domain is in the list
- If using `ALLOWED_EMAILS`: Ensure user's exact email is in the list
- If neither is set: All users are allowed in dev/demo mode

### Session Not Persisting

**Issue**: User logs out immediately or session doesn't persist

**Solution**:
- Ensure `SESSION_SECRET` is set (should be long random string)
- Check that PostgreSQL session table exists
- Verify `DATABASE_URL` is correct

### CORS Errors

**Issue**: Frontend can't reach backend API

**Solution**:
- Update backend CORS settings in `src/index.ts`
- Ensure `FRONTEND_URL` matches your frontend domain
- Check that frontend is making requests with `credentials: true`

## Security Checklist

- ✅ OAuth tokens are not stored for API operations
- ✅ HubSpot Private App token is server-side only
- ✅ Session cookies are httpOnly and Secure
- ✅ All write operations are audit-logged
- ✅ Rate limiting applied to sensitive endpoints
- ✅ Email allowlist enforced
- ✅ CSRF protection via OAuth state parameter

## Local Development

```bash
# Install dependencies
npm install

# Set up .env with OAuth credentials
cp backend/.env.example backend/.env

# Start development servers
npm run dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

## Production Checklist

- [ ] All environment variables configured in Render
- [ ] PostgreSQL database created and initialized
- [ ] HubSpot Private App created with correct scopes
- [ ] OAuth Redirect URI matches deployment domain
- [ ] SESSION_SECRET is long random string (32+ characters)
- [ ] ALLOWED_EMAIL_DOMAINS or ALLOWED_EMAILS configured
- [ ] Backend and frontend domains configured in CORS
- [ ] Database backups enabled (if using Render PostgreSQL)
- [ ] SSL certificates enabled (automatic on Render)

## Support

For issues with:
- **HubSpot OAuth**: Check HubSpot Private App settings and scopes
- **Database**: Verify PostgreSQL connection string format
- **Deployment**: Check Render logs and environment variables

See `.env.example` for detailed variable documentation.
