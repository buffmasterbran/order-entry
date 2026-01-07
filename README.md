# Order Entry System

A Next.js web application for creating orders offline at trade shows, with the ability to sync to NetSuite and Supabase.

## Features

- **Offline-First**: Works completely offline using IndexedDB for local storage
- **Customer Management**: Search, create, and manage customers
- **Order Creation Flow**: 
  - Select customer
  - Choose buyer (contact)
  - Select ship-to and bill-to addresses
  - Add items with barcode scanning support
  - Review and complete order
- **Sync Functionality**: Sync customers and items from NetSuite, push orders to Supabase
- **Desktop-Optimized**: Designed for desktop use at trade shows
- **Barcode Scanning**: Support for barcode scanners to quickly add items

## Setup

### Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account (or local Supabase instance)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the root directory with your NetSuite credentials:

```env
NETSUITE_ACCOUNT_ID=7913744
NETSUITE_CONSUMER_KEY=your_consumer_key
NETSUITE_CONSUMER_SECRET=your_consumer_secret
NETSUITE_TOKEN_ID=your_token_id
NETSUITE_TOKEN_SECRET=your_token_secret

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Set up Supabase database tables. Run these SQL commands in your Supabase SQL editor:

```sql
-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  netsuite_id TEXT,
  entityid TEXT NOT NULL,
  companyname TEXT NOT NULL,
  email TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Addresses table
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  netsuite_id TEXT,
  addr1 TEXT,
  addr2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  country TEXT,
  addressee TEXT,
  addrtext TEXT,
  type TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  netsuite_id TEXT,
  entityid TEXT NOT NULL,
  firstname TEXT,
  lastname TEXT,
  email TEXT,
  phone TEXT,
  title TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  netsuite_id TEXT,
  itemid TEXT NOT NULL,
  displayname TEXT NOT NULL,
  baseprice NUMERIC,
  quantityavailable NUMERIC,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  contact_id TEXT REFERENCES contacts(id),
  ship_address_id TEXT REFERENCES addresses(id),
  bill_address_id TEXT REFERENCES addresses(id),
  items JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_addresses_customer ON addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_customer ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Initial Setup

1. **Sync Data**: Click the "Sync" button to download customers and items from NetSuite. This stores data locally in IndexedDB for offline use.

### Creating an Order

1. **Search for Customer**: Use the search bar to find a customer, or click "New Customer" to create one.
2. **Select Buyer**: Choose a contact/buyer for the order (optional).
3. **Select Addresses**: Choose ship-to and bill-to addresses. You can load addresses from NetSuite or create new ones.
4. **Add Items**: 
   - Search for items or use barcode scanning mode
   - Click items to add them to the order
   - Adjust quantities as needed
5. **Review**: Review the order summary and click "Complete Order" to save it locally.

### Syncing Orders

- Orders are saved locally as "draft" status
- Click "Sync" to push draft orders to Supabase
- Synced orders are marked as "synced" and can be viewed later

## Barcode Scanning

The app supports barcode scanners that act as keyboard input:

1. Click "Barcode Mode" to enable scanning
2. Scan items - the barcode will automatically be entered and searched
3. Items matching the barcode (itemid) will be added to the order

## Architecture

- **Frontend**: Next.js 14 with React and TypeScript
- **Styling**: Tailwind CSS
- **Offline Storage**: IndexedDB (via idb library)
- **Backend**: Next.js API routes for NetSuite OAuth (server-side)
- **Database**: Supabase for synced order storage
- **NetSuite Integration**: SuiteQL queries via REST API

## Notes

- The app works completely offline after initial sync
- NetSuite credentials are kept server-side for security
- All data is stored locally in IndexedDB for offline access
- Orders are pushed to Supabase when syncing (requires internet connection)




