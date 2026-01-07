import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Only create client if we have credentials (for local dev without Supabase)
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Type assertion for development - will fail at runtime if used without config

// Admin client with service role key (bypasses RLS) - for server-side operations
export const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null as any;

// Database types
export interface Customer {
  id: string;
  netsuite_id?: string;
  entityid: string;
  companyname: string;
  email?: string;
  partner?: string; // NetSuite ID of the sales rep (partner) assigned to this customer
  pricelevel?: string;
  synced_at?: string;
  created_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
  netsuite_id?: string;
  addr1?: string;
  addr2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  addressee?: string;
  addrtext?: string;
  type?: 'ship' | 'bill';
  synced_at?: string;
  created_at: string;
}

export interface Contact {
  id: string;
  customer_id: string;
  netsuite_id?: string;
  entityid: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  title?: string;
  synced_at?: string;
  created_at: string;
}

export interface PriceBreak {
  quantity: number;
  price: number;
}

export interface Item {
  id: string;
  netsuite_id?: string;
  itemid: string;
  displayname: string;
  color?: string; // Item color name from custitem_item_color
  price_breaks?: {
    [priceLevel: string]: PriceBreak[]; // e.g., "1": [{quantity: 1, price: 44.00}], "14": [{quantity: 1, price: 44.00}, {quantity: 24, price: 30.80}, ...]
  };
  quantityavailable?: number;
  synced_at?: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  contact_id?: string;
  ship_address_id?: string;
  bill_address_id?: string;
  items: OrderItem[];
  ship_date?: string; // ISO date string
  notes?: string;
  credit_card?: {
    number?: string; // Full card number
    expiry?: string; // MM/YY
    cvv?: string; // Not stored, only for processing
    name?: string;
  };
  status: 'draft' | 'submitted' | 'synced' | 'pushed';
  netsuite_id?: string; // NetSuite sales order ID
  created_by?: string; // Username of user who created the order
  synced_at?: string;
  created_at: string;
}

export interface OrderItem {
  item_id: string;
  quantity: number;
  price?: number;
  notes?: string; // Optional notes for this specific item
}

export interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string; // Lead source: PPAI, Surf Expo, PGA, Atlanta Gift, Vegas Gift, etc.
  notes?: string;
  created_by?: string; // Username of user who created the lead
  synced_at?: string;
  created_at: string;
}

