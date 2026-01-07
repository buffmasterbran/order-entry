import { Customer, Address, Contact, Item, Order } from './supabase';

// Client-side storage using Supabase API routes
export const storage = {
  // Customers
  async getCustomers(): Promise<Customer[]> {
    const response = await fetch('/api/supabase/customers');
    if (!response.ok) throw new Error('Failed to fetch customers');
    const data = await response.json();
    return data.customers || [];
  },

  async searchCustomers(query: string): Promise<Customer[]> {
    const response = await fetch(`/api/supabase/customers?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search customers');
    const data = await response.json();
    return data.customers || [];
  },

  async getCustomer(id: string): Promise<Customer | undefined> {
    const response = await fetch(`/api/supabase/customers/${encodeURIComponent(id)}`);
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.customer;
  },

  async saveCustomer(customer: Customer): Promise<void> {
    const response = await fetch('/api/supabase/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer }),
    });
    if (!response.ok) throw new Error('Failed to save customer');
  },

  async saveCustomers(customers: Customer[]): Promise<void> {
    const response = await fetch('/api/supabase/customers/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customers }),
    });
    if (!response.ok) throw new Error('Failed to save customers');
  },

  // Addresses
  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    const response = await fetch(`/api/supabase/addresses?customer_id=${encodeURIComponent(customerId)}`);
    if (!response.ok) throw new Error('Failed to fetch addresses');
    const data = await response.json();
    return data.addresses || [];
  },

  async saveAddress(address: Address): Promise<void> {
    const response = await fetch('/api/supabase/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    });
    if (!response.ok) throw new Error('Failed to save address');
  },

  async saveAddresses(addresses: Address[]): Promise<void> {
    const response = await fetch('/api/supabase/addresses/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses }),
    });
    if (!response.ok) throw new Error('Failed to save addresses');
  },

  // Contacts
  async getCustomerContacts(customerId: string): Promise<Contact[]> {
    const response = await fetch(`/api/supabase/contacts?customer_id=${encodeURIComponent(customerId)}`);
    if (!response.ok) throw new Error('Failed to fetch contacts');
    const data = await response.json();
    return data.contacts || [];
  },

  async saveContact(contact: Contact): Promise<void> {
    const response = await fetch('/api/supabase/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact }),
    });
    if (!response.ok) throw new Error('Failed to save contact');
  },

  async saveContacts(contacts: Contact[]): Promise<void> {
    const response = await fetch('/api/supabase/contacts/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts }),
    });
    if (!response.ok) throw new Error('Failed to save contacts');
  },

  // Items
  async getItems(): Promise<Item[]> {
    const response = await fetch('/api/supabase/items');
    if (!response.ok) throw new Error('Failed to fetch items');
    const data = await response.json();
    return data.items || [];
  },

  async searchItems(query: string): Promise<Item[]> {
    const response = await fetch(`/api/supabase/items?search=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search items');
    const data = await response.json();
    return data.items || [];
  },

  async getItemByItemId(itemid: string): Promise<Item | undefined> {
    const response = await fetch(`/api/supabase/items/by-itemid/${encodeURIComponent(itemid)}`);
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.item;
  },

  async saveItem(item: Item): Promise<void> {
    const response = await fetch('/api/supabase/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    });
    if (!response.ok) throw new Error('Failed to save item');
  },

  async saveItems(items: Item[]): Promise<void> {
    const response = await fetch('/api/supabase/items/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) throw new Error('Failed to save items');
  },

  // Orders
  async getOrders(): Promise<Order[]> {
    const response = await fetch('/api/supabase/orders');
    if (!response.ok) throw new Error('Failed to fetch orders');
    const data = await response.json();
    return data.orders || [];
  },

  async getOrder(id: string): Promise<Order | undefined> {
    const response = await fetch(`/api/supabase/orders/${encodeURIComponent(id)}`);
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.order;
  },

  async saveOrder(order: Order): Promise<void> {
    const response = await fetch('/api/supabase/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    });
    if (!response.ok) throw new Error('Failed to save order');
  },

  async deleteOrder(orderId: string): Promise<void> {
    const response = await fetch(`/api/supabase/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete order');
  },

  async getDraftOrders(): Promise<Order[]> {
    const response = await fetch('/api/supabase/orders?status=draft');
    if (!response.ok) throw new Error('Failed to fetch draft orders');
    const data = await response.json();
    return data.orders || [];
  },
};

