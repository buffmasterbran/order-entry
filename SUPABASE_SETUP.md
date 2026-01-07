# Supabase Setup Guide

## What Credentials You Need

You need **2 environment variables**:

1. `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

---

## Option 1: Local Supabase (Recommended for Development)

### Step 1: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (Mac)
brew install supabase/tap/supabase

# Or using Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Step 2: Initialize Supabase Locally

```bash
# In your project root
supabase init
```

### Step 3: Start Local Supabase

```bash
supabase start
```

This will output something like:
```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Add to .env.local

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copy the anon key from above>
```

### Step 5: Run Database Schema

```bash
# Copy the SQL from supabase-schema.sql and run it
supabase db reset
# Or use the Supabase Studio UI at http://localhost:54323
```

---

## Option 2: Cloud Supabase (Production)

### Step 1: Create Supabase Account

1. Go to https://supabase.com
2. Sign up for a free account
3. Create a new project

### Step 2: Get Your Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. You'll see:
   - **Project URL** - This is your `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** - This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Step 3: Add to .env.local

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase-schema.sql`
3. Paste and run it

---

## Quick Setup (If You Just Want to Test Without Supabase)

You can actually run the app **without Supabase** for testing! The app will:
- ✅ Work offline with IndexedDB
- ✅ Allow you to create orders
- ✅ Store everything locally
- ❌ Won't be able to sync orders to Supabase (but that's okay for testing)

Just leave the Supabase env vars empty or don't set them. The app will gracefully handle it.

---

## Verify Your Setup

After setting up, you can verify by:

1. Starting your Next.js app: `npm run dev`
2. Opening the browser console
3. The app should load without Supabase errors
4. When you click "Sync", it will try to push orders to Supabase

---

## Troubleshooting

### "Supabase not configured" error
- Make sure your `.env.local` file has both variables set
- Restart your Next.js dev server after changing `.env.local`

### Database connection errors
- Make sure you've run the SQL schema (`supabase-schema.sql`)
- Check that your Supabase project is running (if local) or active (if cloud)

### Can't find anon key
- In Supabase dashboard: Settings → API → Project API keys
- Look for the "anon" or "public" key (NOT the service_role key)




