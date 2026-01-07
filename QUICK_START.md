# Quick Start - Supabase Credentials

## What You Need

Add these **2 lines** to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=<your-url-here>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key-here>
```

---

## Easiest Option: Local Supabase

### 1. Install Supabase CLI
```bash
npm install -g supabase
```

### 2. Start Local Supabase
```bash
supabase start
```

### 3. Copy the Output
You'll see something like:
```
API URL: http://localhost:54321
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 4. Add to `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 5. Run the Database Schema
Open Supabase Studio (usually at http://localhost:54323), go to SQL Editor, and run the SQL from `supabase-schema.sql`

---

## Cloud Option: Supabase.com

1. Sign up at https://supabase.com
2. Create a new project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Add to `.env.local`
6. Go to **SQL Editor** and run `supabase-schema.sql`

---

## Skip Supabase (Testing Only)

You can test the app **without Supabase**! Just don't set those env vars. The app will:
- ✅ Work offline
- ✅ Store orders locally
- ❌ Won't sync to cloud (but that's fine for testing)

---

## Your Complete `.env.local` Should Look Like:

```env
# NetSuite (you already have these)
NETSUITE_ACCOUNT_ID=7913744
NETSUITE_CONSUMER_KEY=e05657cf2d8c89d5e819f7031df0c49f49298ee6b9f710fb027a0f9da126176d
NETSUITE_CONSUMER_SECRET=7e0d98406d4094c1c7d301a9563e7202ab0b2c8bed616c11e045d4a2c8b96c2e
NETSUITE_TOKEN_ID=136aee4a2af579e53ec6a8f24af5b85fbad2776d0d99847fa4101b7b33cd8882
NETSUITE_TOKEN_SECRET=d52d3602753362f4267d7be67d08a4ad17d2c05d8f0982acb1fdb6d47b0c8b44

# Supabase (add these)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

**That's it!** After adding these, restart your dev server (`npm run dev`).




