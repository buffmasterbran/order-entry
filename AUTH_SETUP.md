# Authentication Setup Guide

This application uses NetSuite RESTlet authentication with Supabase for user management.

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase Configuration (you should already have these)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# NEW: Supabase Service Role Key (required for authentication)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# NetSuite OAuth Credentials (you already have these)
NETSUITE_ACCOUNT_ID=7913744
NETSUITE_CONSUMER_KEY=your_consumer_key
NETSUITE_CONSUMER_SECRET=your_consumer_secret
NETSUITE_TOKEN_ID=your_token_id
NETSUITE_TOKEN_SECRET=your_token_secret

# NEW: Session Encryption Key
SESSION_SECRET=your_jwt_secret_key_min_32_chars_long
```

### Getting the Supabase Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key - this is a secret key)
4. Add it to `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ Important**: Never commit the service role key to git. It has full database access.

### Getting the Session Secret

The `SESSION_SECRET` is used to encrypt JWT session cookies. Generate a random string:

```bash
# On Unix/Mac:
openssl rand -base64 32

# Or use any random string generator (minimum 32 characters)
```

Add it to `.env.local` as `SESSION_SECRET`.

## Database Setup

Run the SQL in `supabase-schema-auth.sql` in your Supabase SQL Editor:

```sql
-- Users table (shared across applications)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    netsuite_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS users_netsuite_id_idx ON users(netsuite_id);
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);
```

## How It Works

1. **Login**: Users enter their NetSuite username/password
2. **Authentication**: System calls NetSuite RESTlet to verify credentials
3. **User Storage**: User data is upserted into Supabase `users` table
4. **Session**: JWT session cookie is created (7-day expiration)
5. **Access Control**: Middleware protects all routes except `/login`

## NetSuite RESTlet

The authentication uses a NetSuite RESTlet:
- **URL**: `https://7913744.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2276&deploy=1`
- **Method**: GET
- **Authentication**: OAuth 1.0a (same credentials as your SuiteQL API)

The RESTlet should return JSON with an `employees` array containing user credentials.

## Testing

1. Start your development server: `npm run dev`
2. Navigate to `http://localhost:3000`
3. You should be redirected to `/login`
4. Enter your NetSuite username and password
5. You should be redirected back to the home page

## Notes

- The `users` table is shared across applications (if you have multiple apps)
- User admin status comes from NetSuite's `custentity_pir_emp_admin_rights` field
- Passwords are never stored - authentication happens via NetSuite RESTlet
- Sessions expire after 7 days
- The middleware automatically redirects unauthenticated users to `/login`



