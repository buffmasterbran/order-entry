import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Customer, Address, Contact, Item, Order, Lead } from './supabase';

interface OrderEntryDB extends DBSchema {
  customers: {
    key: string;
    value: Customer;
    indexes: { 'by-entityid': string; 'by-companyname': string };
  };
  addresses: {
    key: string;
    value: Address;
    indexes: { 'by-customer': string };
  };
  contacts: {
    key: string;
    value: Contact;
    indexes: { 'by-customer': string };
  };
  items: {
    key: string;
    value: Item;
    indexes: { 'by-itemid': string; 'by-displayname': string };
  };
  orders: {
    key: string;
    value: Order;
    indexes: { 'by-status': string; 'by-customer': string };
  };
  leads: {
    key: string;
    value: Lead;
    indexes: { 'by-created': string };
  };
  metadata: {
    key: string;
    value: { key: string; value: any };
  };
}

let dbPromise: Promise<IDBPDatabase<OrderEntryDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OrderEntryDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OrderEntryDB>('order-entry-db', 3, {
      upgrade(db, oldVersion) {
        // Version 1 stores
        if (oldVersion < 1) {
          // Customers store
          const customerStore = db.createObjectStore('customers', {
            keyPath: 'id',
          });
          customerStore.createIndex('by-entityid', 'entityid');
          customerStore.createIndex('by-companyname', 'companyname');

          // Addresses store
          const addressStore = db.createObjectStore('addresses', {
            keyPath: 'id',
          });
          addressStore.createIndex('by-customer', 'customer_id');

          // Contacts store
          const contactStore = db.createObjectStore('contacts', {
            keyPath: 'id',
          });
          contactStore.createIndex('by-customer', 'customer_id');

          // Items store
          const itemStore = db.createObjectStore('items', {
            keyPath: 'id',
          });
          itemStore.createIndex('by-itemid', 'itemid');
          itemStore.createIndex('by-displayname', 'displayname');

          // Orders store
          const orderStore = db.createObjectStore('orders', {
            keyPath: 'id',
          });
          orderStore.createIndex('by-status', 'status');
          orderStore.createIndex('by-customer', 'customer_id');
        }

        // Version 2: Add metadata store
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('metadata')) {
            db.createObjectStore('metadata', {
              keyPath: 'key',
            });
          }
        }

        // Version 3: Add leads store
        if (oldVersion < 3) {
          if (!db.objectStoreNames.contains('leads')) {
            const leadStore = db.createObjectStore('leads', {
              keyPath: 'id',
            });
            leadStore.createIndex('by-created', 'created_at');
          }
        }
      },
    });
  }
  return dbPromise;
}

// Helper to check if online and sync to Supabase
// This is fire-and-forget - never throws errors to ensure local saves always succeed
async function syncToSupabase(operation: () => Promise<void>): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await operation();
    }
  } catch (error) {
    // Silently fail - the data is already saved locally in IndexedDB
    // We can retry syncing later
    console.warn('Supabase sync failed (data is safe in IndexedDB):', error);
    // Don't throw - offline mode should still work
  }
}

// Supabase API helpers
async function supabaseFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
  return response.json();
}

export const storage = {
  // Customers
  async getCustomers(): Promise<Customer[]> {
    const db = await getDB();
    return db.getAll('customers');
  },

  async searchCustomers(query: string): Promise<Customer[]> {
    const db = await getDB();
    const allCustomers = await db.getAll('customers');
    const lowerQuery = query.toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.companyname.toLowerCase().includes(lowerQuery) ||
        c.entityid.toLowerCase().includes(lowerQuery) ||
        (c.email && c.email.toLowerCase().includes(lowerQuery))
    );
  },

  async getCustomer(id: string): Promise<Customer | undefined> {
    const db = await getDB();
    return db.get('customers', id);
  },

  async saveCustomer(customer: Customer): Promise<void> {
    const db = await getDB();
    
    // Try to push to NetSuite if customer doesn't have netsuite_id (local-only customer)
    if (!customer.netsuite_id) {
      try {
        console.log('Attempting to push customer to NetSuite:', {
          companyname: customer.companyname,
          email: customer.email,
        });
        const response = await fetch('/api/netsuite/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyname: customer.companyname,
            email: customer.email,
            subsidiary: (customer as any).subsidiary,
            partner: (customer as any).partner,
            customerCategory: (customer as any).customerCategory,
            priceLevel: (customer as any).priceLevel,
            customerSalesChannel: (customer as any).customerSalesChannel,
            customerSource: (customer as any).customerSource,
          }),
        });
        console.log('NetSuite API response status:', response.status);
        
        const responseText = await response.text();
        console.log('NetSuite API response body:', responseText);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            // Update customer with NetSuite ID and entityid
            customer.netsuite_id = result.netsuiteId;
            if (result.entityid) {
              customer.entityid = result.entityid;
            }
            customer.synced_at = new Date().toISOString();
          } catch (parseError) {
            console.error('Error parsing NetSuite response:', parseError);
          }
        } else {
          console.error('NetSuite API error response:', responseText);
        }
        // If it fails, customer stays local-only (works offline)
      } catch (error) {
        // Fail silently - customer stays local-only, can be pushed later
        console.log('Could not push customer to NetSuite (offline or error):', error);
      }
    }
    
    await db.put('customers', customer);
    
    // After customer is successfully synced to NetSuite, retry syncing contacts and addresses for this customer
    // This handles the case where contacts/addresses were created before the customer had netsuite_id
    if (customer.netsuite_id) {
      console.log(`Customer ${customer.companyname} has netsuite_id ${customer.netsuite_id}, calling retrySyncContactsAndAddressesForCustomer...`);
      await this.retrySyncContactsAndAddressesForCustomer(customer.id).catch((error) => {
        console.error('Error retrying contact/address sync after customer sync:', error);
        // Don't throw - customer sync succeeded, contact/address sync can be retried later
      });
    } else {
      console.log(`Customer ${customer.companyname} does not have netsuite_id, skipping contact/address retry`);
    }
    
    // Sync to Supabase in background - only send fields that exist in Supabase schema
    await syncToSupabase(async () => {
      const supabaseCustomer = {
        id: customer.id,
        netsuite_id: customer.netsuite_id,
        entityid: customer.entityid,
        companyname: customer.companyname,
        email: customer.email,
        synced_at: customer.synced_at,
        created_at: customer.created_at,
      };
      await supabaseFetch('/api/supabase/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: supabaseCustomer }),
      });
    });
  },

  async saveCustomers(customers: Customer[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('customers', 'readwrite');
    await Promise.all(customers.map((c) => tx.store.put(c)));
    await tx.done;
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch('/api/supabase/customers/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customers }),
      });
    });
  },

  // Clear all customers, contacts, and addresses before re-syncing from NetSuite
  // WARNING: This will delete all data, including local-only records (created offline but not yet synced)
  async clearCustomersContactsAndAddresses(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['customers', 'contacts', 'addresses'], 'readwrite');
    await tx.objectStore('customers').clear();
    await tx.objectStore('contacts').clear();
    await tx.objectStore('addresses').clear();
    await tx.done;
  },

  // Get customers that need to be pushed to NetSuite (created offline, no netsuite_id)
  async getUnsyncedCustomers(): Promise<Customer[]> {
    const db = await getDB();
    const allCustomers = await db.getAll('customers');
    return allCustomers.filter((c) => !c.netsuite_id);
  },

  // Retry pushing unsynced customers to NetSuite
  async retrySyncCustomers(): Promise<{ synced: number; failed: number }> {
    console.log('=== Retry sync customers: Starting ===');
    const unsynced = await this.getUnsyncedCustomers();
    console.log(`Found ${unsynced.length} unsynced customers to push to NetSuite`);
    
    if (unsynced.length === 0) {
      console.log('No unsynced customers to push');
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    const db = await getDB();

    for (const customer of unsynced) {
      try {
        console.log(`Attempting to push customer to NetSuite: ${customer.companyname} (ID: ${customer.id})`);
        const response = await fetch('/api/netsuite/customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyname: customer.companyname,
            email: customer.email,
            subsidiary: (customer as any).subsidiary,
            partner: (customer as any).partner,
            customerCategory: (customer as any).customerCategory,
            priceLevel: (customer as any).priceLevel,
            customerSalesChannel: (customer as any).customerSalesChannel,
            customerSource: (customer as any).customerSource,
          }),
        });
        
        console.log(`NetSuite API response status for ${customer.companyname}: ${response.status}`);
        const responseText = await response.text();
        console.log(`NetSuite API response body for ${customer.companyname}:`, responseText);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            // Update customer with NetSuite ID and entityid
            const updatedCustomer = {
              ...customer,
              netsuite_id: result.netsuiteId,
              entityid: result.entityid || customer.entityid,
              synced_at: new Date().toISOString(),
            };
            await db.put('customers', updatedCustomer);
            console.log(`Successfully pushed customer ${customer.companyname} to NetSuite. NetSuite ID: ${result.netsuiteId}`);
            
            // Also sync to Supabase
            await syncToSupabase(async () => {
              const supabaseCustomer = {
                id: updatedCustomer.id,
                netsuite_id: updatedCustomer.netsuite_id,
                entityid: updatedCustomer.entityid,
                companyname: updatedCustomer.companyname,
                email: updatedCustomer.email,
                synced_at: updatedCustomer.synced_at,
                created_at: updatedCustomer.created_at,
              };
              await supabaseFetch('/api/supabase/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customer: supabaseCustomer }),
              });
            });
            
            // After customer is successfully synced, retry syncing contacts and addresses for this customer
            // This handles the case where contacts/addresses were created offline before the customer had netsuite_id
            await this.retrySyncContactsAndAddressesForCustomer(customer.id).catch((error) => {
              console.error(`Error retrying contact/address sync for customer ${customer.companyname}:`, error);
              // Don't throw - customer sync succeeded, contact/address sync can be retried later
            });
            
            synced++;
          } catch (parseError) {
            console.error(`Error parsing NetSuite response for ${customer.companyname}:`, parseError);
            failed++;
          }
        } else {
          console.error(`NetSuite API error for ${customer.companyname}:`, responseText);
          failed++;
        }
      } catch (error) {
        console.error(`Failed to push customer ${customer.companyname} to NetSuite:`, error);
        failed++;
      }
    }

    console.log(`=== Retry sync customers: Complete. Synced: ${synced}, Failed: ${failed} ===`);
    return { synced, failed };
  },

  // Addresses
  async getCustomerAddresses(customerId: string): Promise<Address[]> {
    const db = await getDB();
    return db.getAllFromIndex('addresses', 'by-customer', customerId);
  },

  async saveAddress(address: Address): Promise<void> {
    const db = await getDB();
    console.log('storage.saveAddress - received address:', address);
    
    // Try to push to NetSuite if address doesn't have netsuite_id (local-only address)
    if (!address.netsuite_id) {
      try {
        // Get the customer to get its NetSuite ID
        const customer = await this.getCustomer(address.customer_id);
        if (customer?.netsuite_id) {
          console.log('Attempting to push address to NetSuite:', {
            customerId: customer.netsuite_id,
            addr1: address.addr1,
            addr2: address.addr2,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country,
            addressee: address.addressee,
            isDefaultShipping: (address as any).isDefaultShipping,
            isDefaultBilling: (address as any).isDefaultBilling,
          });
          const response = await fetch('/api/netsuite/address', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: customer.netsuite_id,
              addr1: address.addr1,
              addr2: address.addr2,
              city: address.city,
              state: address.state,
              zip: address.zip,
              country: address.country,
              addressee: address.addressee,
              isDefaultShipping: (address as any).isDefaultShipping ?? address.type === 'ship',
              isDefaultBilling: (address as any).isDefaultBilling ?? address.type === 'bill',
              label: (address as any).isDefaultShipping ? 'Shipping' : (address as any).isDefaultBilling ? 'Billing' : undefined,
            }),
          });
          console.log('NetSuite API response status:', response.status);
          
          const responseText = await response.text();
          console.log('NetSuite API response body:', responseText);

          if (response.ok) {
            try {
              const result = JSON.parse(responseText);
              // Update address with NetSuite ID
              if (result.netsuiteId) {
                address.netsuite_id = result.netsuiteId;
                address.synced_at = new Date().toISOString();
              }
            } catch (parseError) {
              console.error('Error parsing NetSuite response:', parseError);
            }
          } else {
            console.error('NetSuite API error response:', responseText);
          }
        } else {
          console.log('Address cannot be pushed to NetSuite: Customer does not have NetSuite ID');
        }
        // If it fails, address stays local-only (works offline)
      } catch (error) {
        // Fail silently - address stays local-only, can be pushed later
        console.log('Could not push address to NetSuite (offline or error):', error);
      }
    }
    
    await db.put('addresses', address);
    // Sync to Supabase in background - only send fields that exist in Supabase schema
    await syncToSupabase(async () => {
      const supabaseAddress = {
        id: address.id,
        customer_id: address.customer_id,
        netsuite_id: address.netsuite_id,
        addr1: address.addr1,
        addr2: address.addr2,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
        addressee: address.addressee,
        addrtext: address.addrtext,
        type: address.type,
        synced_at: address.synced_at,
        created_at: address.created_at,
      };
      await supabaseFetch('/api/supabase/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: supabaseAddress }),
      });
    });
  },

  async saveAddresses(addresses: Address[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('addresses', 'readwrite');
    await Promise.all(addresses.map((a) => tx.store.put(a)));
    await tx.done;
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch('/api/supabase/addresses/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });
    });
  },

  // Get addresses that need to be pushed to NetSuite (created offline, no netsuite_id, but customer has netsuite_id)
  async getUnsyncedAddresses(): Promise<Address[]> {
    const db = await getDB();
    const allAddresses = await db.getAll('addresses');
    const unsynced: Address[] = [];
    
    for (const address of allAddresses) {
      if (!address.netsuite_id) {
        const customer = await this.getCustomer(address.customer_id);
        if (customer?.netsuite_id) {
          unsynced.push(address);
        }
      }
    }
    
    return unsynced;
  },

  // Helper function to retry syncing contacts and addresses for a specific customer
  // Called after a customer is successfully synced to NetSuite
  async retrySyncContactsAndAddressesForCustomer(customerId: string): Promise<void> {
    console.log(`=== Retry sync contacts/addresses for customer ${customerId}: Starting ===`);
    const db = await getDB();
    const customer = await this.getCustomer(customerId);
    
    if (!customer?.netsuite_id) {
      console.log(`Customer ${customerId} does not have NetSuite ID yet, skipping contact/address sync`);
      return;
    }

    // Get unsynced contacts for this customer
    const allContacts = await db.getAllFromIndex('contacts', 'by-customer', customerId);
    const unsyncedContacts = allContacts.filter((c) => !c.netsuite_id);
    
    // Get unsynced addresses for this customer
    const allAddresses = await db.getAllFromIndex('addresses', 'by-customer', customerId);
    const unsyncedAddresses = allAddresses.filter((a) => !a.netsuite_id);

    console.log(`Found ${unsyncedContacts.length} unsynced contacts and ${unsyncedAddresses.length} unsynced addresses for customer ${customer.companyname}`);

    // Sync contacts
    for (const contact of unsyncedContacts) {
      try {
        console.log(`Attempting to push contact to NetSuite: ${contact.firstname} ${contact.lastname} (Customer: ${customer.companyname})`);
        const response = await fetch('/api/netsuite/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.netsuite_id,
            firstname: contact.firstname,
            lastname: contact.lastname,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
          }),
        });
        
        const responseText = await response.text();
        console.log(`NetSuite API response status for contact ${contact.firstname} ${contact.lastname}: ${response.status}`);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            const updatedContact = {
              ...contact,
              netsuite_id: result.netsuiteId,
              synced_at: new Date().toISOString(),
            };
            await db.put('contacts', updatedContact);
            console.log(`Successfully pushed contact ${contact.firstname} ${contact.lastname} to NetSuite. NetSuite ID: ${result.netsuiteId}`);
            
            await syncToSupabase(async () => {
              const supabaseContact = {
                id: updatedContact.id,
                customer_id: updatedContact.customer_id,
                netsuite_id: updatedContact.netsuite_id,
                entityid: updatedContact.entityid,
                firstname: updatedContact.firstname,
                lastname: updatedContact.lastname,
                email: updatedContact.email,
                phone: updatedContact.phone,
                title: updatedContact.title,
                synced_at: updatedContact.synced_at,
                created_at: updatedContact.created_at,
              };
              await supabaseFetch('/api/supabase/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact: supabaseContact }),
              });
            });
          } catch (parseError) {
            console.error(`Error parsing NetSuite response for contact ${contact.firstname} ${contact.lastname}:`, parseError);
          }
        } else {
          console.error(`NetSuite API error for contact ${contact.firstname} ${contact.lastname}:`, responseText);
        }
      } catch (error) {
        console.error(`Failed to push contact ${contact.firstname} ${contact.lastname} to NetSuite:`, error);
      }
    }

    // Sync addresses
    for (const address of unsyncedAddresses) {
      try {
        console.log(`Attempting to push address to NetSuite: ${address.addr1 || address.addrtext} (Customer: ${customer.companyname})`);
        const response = await fetch('/api/netsuite/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.netsuite_id,
            addr1: address.addr1,
            addr2: address.addr2,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country,
            addressee: address.addressee,
            isDefaultShipping: (address as any).isDefaultShipping ?? address.type === 'ship',
            isDefaultBilling: (address as any).isDefaultBilling ?? address.type === 'bill',
            label: (address as any).isDefaultShipping ? 'Shipping' : (address as any).isDefaultBilling ? 'Billing' : undefined,
          }),
        });
        
        const responseText = await response.text();
        console.log(`NetSuite API response status for address ${address.addr1 || address.addrtext}: ${response.status}`);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            const updatedAddress = {
              ...address,
              netsuite_id: result.netsuiteId || address.netsuite_id,
              synced_at: new Date().toISOString(),
            };
            await db.put('addresses', updatedAddress);
            console.log(`Successfully pushed address ${address.addr1 || address.addrtext} to NetSuite`);
            
            await syncToSupabase(async () => {
              const supabaseAddress = {
                id: updatedAddress.id,
                customer_id: updatedAddress.customer_id,
                netsuite_id: updatedAddress.netsuite_id,
                addr1: updatedAddress.addr1,
                addr2: updatedAddress.addr2,
                city: updatedAddress.city,
                state: updatedAddress.state,
                zip: updatedAddress.zip,
                country: updatedAddress.country,
                addressee: updatedAddress.addressee,
                addrtext: updatedAddress.addrtext,
                type: updatedAddress.type,
                synced_at: updatedAddress.synced_at,
                created_at: updatedAddress.created_at,
              };
              await supabaseFetch('/api/supabase/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: supabaseAddress }),
              });
            });
          } catch (parseError) {
            console.error(`Error parsing NetSuite response for address ${address.addr1 || address.addrtext}:`, parseError);
          }
        } else {
          console.error(`NetSuite API error for address ${address.addr1 || address.addrtext}:`, responseText);
        }
      } catch (error) {
        console.error(`Failed to push address ${address.addr1 || address.addrtext} to NetSuite:`, error);
      }
    }

    console.log(`=== Retry sync contacts/addresses for customer ${customerId}: Complete ===`);
  },

  // Retry pushing unsynced addresses to NetSuite
  async retrySyncAddresses(): Promise<{ synced: number; failed: number }> {
    console.log('=== Retry sync addresses: Starting ===');
    const unsynced = await this.getUnsyncedAddresses();
    console.log(`Found ${unsynced.length} unsynced addresses to push to NetSuite`);
    
    if (unsynced.length === 0) {
      console.log('No unsynced addresses to push');
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    const db = await getDB();

    for (const address of unsynced) {
      try {
        const customer = await this.getCustomer(address.customer_id);
        if (!customer?.netsuite_id) {
          console.log(`Skipping address ${address.addr1 || address.addrtext}: Customer does not have NetSuite ID yet`);
          continue;
        }

        console.log(`Attempting to push address to NetSuite: ${address.addr1 || address.addrtext} (Customer: ${customer.companyname})`);
        const response = await fetch('/api/netsuite/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.netsuite_id,
            addr1: address.addr1,
            addr2: address.addr2,
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: address.country,
            addressee: address.addressee,
            isDefaultShipping: (address as any).isDefaultShipping ?? address.type === 'ship',
            isDefaultBilling: (address as any).isDefaultBilling ?? address.type === 'bill',
            label: (address as any).isDefaultShipping ? 'Shipping' : (address as any).isDefaultBilling ? 'Billing' : undefined,
          }),
        });
        
        console.log(`NetSuite API response status for address ${address.addr1 || address.addrtext}: ${response.status}`);
        const responseText = await response.text();
        console.log(`NetSuite API response body for address ${address.addr1 || address.addrtext}:`, responseText);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            // Update address with NetSuite ID (if returned)
            const updatedAddress = {
              ...address,
              netsuite_id: result.netsuiteId || address.netsuite_id, // NetSuite might not return address ID for sublist items
              synced_at: new Date().toISOString(),
            };
            await db.put('addresses', updatedAddress);
            console.log(`Successfully pushed address ${address.addr1 || address.addrtext} to NetSuite`);
            
            // Also sync to Supabase
            await syncToSupabase(async () => {
              const supabaseAddress = {
                id: updatedAddress.id,
                customer_id: updatedAddress.customer_id,
                netsuite_id: updatedAddress.netsuite_id,
                addr1: updatedAddress.addr1,
                addr2: updatedAddress.addr2,
                city: updatedAddress.city,
                state: updatedAddress.state,
                zip: updatedAddress.zip,
                country: updatedAddress.country,
                addressee: updatedAddress.addressee,
                addrtext: updatedAddress.addrtext,
                type: updatedAddress.type,
                synced_at: updatedAddress.synced_at,
                created_at: updatedAddress.created_at,
              };
              await supabaseFetch('/api/supabase/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: supabaseAddress }),
              });
            });
            
            synced++;
          } catch (parseError) {
            console.error(`Error parsing NetSuite response for address ${address.addr1 || address.addrtext}:`, parseError);
            failed++;
          }
        } else {
          console.error(`NetSuite API error for address ${address.addr1 || address.addrtext}:`, responseText);
          failed++;
        }
      } catch (error) {
        console.error(`Failed to push address ${address.addr1 || address.addrtext} to NetSuite:`, error);
        failed++;
      }
    }

    console.log(`=== Retry sync addresses: Complete. Synced: ${synced}, Failed: ${failed} ===`);
    return { synced, failed };
  },

  // Contacts
  async getCustomerContacts(customerId: string): Promise<Contact[]> {
    const db = await getDB();
    return db.getAllFromIndex('contacts', 'by-customer', customerId);
  },

  async saveContact(contact: Contact): Promise<void> {
    const db = await getDB();
    
    // Try to push to NetSuite if contact doesn't have netsuite_id (local-only contact)
    if (!contact.netsuite_id) {
      try {
        // Get the customer to get its NetSuite ID
        const customer = await this.getCustomer(contact.customer_id);
        if (customer?.netsuite_id) {
          console.log('Attempting to push contact to NetSuite:', {
            customerId: customer.netsuite_id,
            firstname: contact.firstname,
            lastname: contact.lastname,
          });
          const response = await fetch('/api/netsuite/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: customer.netsuite_id,
              firstname: contact.firstname,
              lastname: contact.lastname,
              email: contact.email,
              phone: contact.phone,
              title: contact.title,
            }),
          });
          console.log('NetSuite API response status:', response.status);
          
          const responseText = await response.text();
          console.log('NetSuite API response body:', responseText);

          if (response.ok) {
            try {
              const result = JSON.parse(responseText);
              // Update contact with NetSuite ID and entityid
              contact.netsuite_id = result.netsuiteId;
              if (result.entityid) {
                contact.entityid = result.entityid;
              }
              contact.synced_at = new Date().toISOString();
            } catch (parseError) {
              console.error('Error parsing NetSuite response:', parseError);
            }
          } else {
            console.error('NetSuite API error response:', responseText);
          }
        } else {
          console.log('Contact cannot be pushed to NetSuite: Customer does not have NetSuite ID');
        }
        // If it fails, contact stays local-only (works offline)
      } catch (error) {
        // Fail silently - contact stays local-only, can be pushed later
        console.log('Could not push contact to NetSuite (offline or error):', error);
      }
    }
    
    await db.put('contacts', contact);
    // Sync to Supabase in background - only send fields that exist in Supabase schema
    await syncToSupabase(async () => {
      const supabaseContact = {
        id: contact.id,
        customer_id: contact.customer_id,
        netsuite_id: contact.netsuite_id,
        entityid: contact.entityid,
        firstname: contact.firstname,
        lastname: contact.lastname,
        email: contact.email,
        phone: contact.phone,
        title: contact.title,
        synced_at: contact.synced_at,
        created_at: contact.created_at,
      };
      await supabaseFetch('/api/supabase/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: supabaseContact }),
      });
    });
  },

  async saveContacts(contacts: Contact[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('contacts', 'readwrite');
    await Promise.all(contacts.map((c) => tx.store.put(c)));
    await tx.done;
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch('/api/supabase/contacts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });
    });
  },

  // Get contacts that need to be pushed to NetSuite (created offline, no netsuite_id, but customer has netsuite_id)
  async getUnsyncedContacts(): Promise<Contact[]> {
    const db = await getDB();
    const allContacts = await db.getAll('contacts');
    const unsynced: Contact[] = [];
    
    for (const contact of allContacts) {
      if (!contact.netsuite_id) {
        const customer = await this.getCustomer(contact.customer_id);
        if (customer?.netsuite_id) {
          unsynced.push(contact);
        }
      }
    }
    
    return unsynced;
  },

  // Retry pushing unsynced contacts to NetSuite
  async retrySyncContacts(): Promise<{ synced: number; failed: number }> {
    console.log('=== Retry sync contacts: Starting ===');
    const unsynced = await this.getUnsyncedContacts();
    console.log(`Found ${unsynced.length} unsynced contacts to push to NetSuite`);
    
    if (unsynced.length === 0) {
      console.log('No unsynced contacts to push');
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    const db = await getDB();

    for (const contact of unsynced) {
      try {
        const customer = await this.getCustomer(contact.customer_id);
        if (!customer?.netsuite_id) {
          console.log(`Skipping contact ${contact.firstname} ${contact.lastname}: Customer does not have NetSuite ID yet`);
          continue;
        }

        console.log(`Attempting to push contact to NetSuite: ${contact.firstname} ${contact.lastname} (Customer: ${customer.companyname})`);
        const response = await fetch('/api/netsuite/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customer.netsuite_id,
            firstname: contact.firstname,
            lastname: contact.lastname,
            email: contact.email,
            phone: contact.phone,
            title: contact.title,
          }),
        });
        
        console.log(`NetSuite API response status for contact ${contact.firstname} ${contact.lastname}: ${response.status}`);
        const responseText = await response.text();
        console.log(`NetSuite API response body for contact ${contact.firstname} ${contact.lastname}:`, responseText);

        if (response.ok) {
          try {
            const result = JSON.parse(responseText);
            // Update contact with NetSuite ID
            const updatedContact = {
              ...contact,
              netsuite_id: result.netsuiteId,
              synced_at: new Date().toISOString(),
            };
            await db.put('contacts', updatedContact);
            console.log(`Successfully pushed contact ${contact.firstname} ${contact.lastname} to NetSuite. NetSuite ID: ${result.netsuiteId}`);
            
            // Also sync to Supabase
            await syncToSupabase(async () => {
              const supabaseContact = {
                id: updatedContact.id,
                customer_id: updatedContact.customer_id,
                netsuite_id: updatedContact.netsuite_id,
                entityid: updatedContact.entityid,
                firstname: updatedContact.firstname,
                lastname: updatedContact.lastname,
                email: updatedContact.email,
                phone: updatedContact.phone,
                title: updatedContact.title,
                synced_at: updatedContact.synced_at,
                created_at: updatedContact.created_at,
              };
              await supabaseFetch('/api/supabase/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact: supabaseContact }),
              });
            });
            
            synced++;
          } catch (parseError) {
            console.error(`Error parsing NetSuite response for contact ${contact.firstname} ${contact.lastname}:`, parseError);
            failed++;
          }
        } else {
          console.error(`NetSuite API error for contact ${contact.firstname} ${contact.lastname}:`, responseText);
          failed++;
        }
      } catch (error) {
        console.error(`Failed to push contact ${contact.firstname} ${contact.lastname} to NetSuite:`, error);
        failed++;
      }
    }

    console.log(`=== Retry sync contacts: Complete. Synced: ${synced}, Failed: ${failed} ===`);
    return { synced, failed };
  },

  // Items
  async getItems(): Promise<Item[]> {
    const db = await getDB();
    return db.getAll('items');
  },

  async searchItems(query: string): Promise<Item[]> {
    const db = await getDB();
    const allItems = await db.getAll('items');
    const lowerQuery = query.toLowerCase();
    return allItems.filter(
      (i) =>
        i.itemid.toLowerCase().includes(lowerQuery) ||
        i.displayname.toLowerCase().includes(lowerQuery)
    );
  },

  async getItemByItemId(itemid: string): Promise<Item | undefined> {
    const db = await getDB();
    const items = await db.getAllFromIndex('items', 'by-itemid', itemid);
    return items[0];
  },

  async saveItem(item: Item): Promise<void> {
    const db = await getDB();
    await db.put('items', item);
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch('/api/supabase/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      });
    });
  },

  async saveItems(items: Item[]): Promise<void> {
    const db = await getDB();
    const tx = db.transaction('items', 'readwrite');
    await Promise.all(items.map((i) => tx.store.put(i)));
    await tx.done;
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch('/api/supabase/items/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
    });
  },

  // Orders
  async getOrders(): Promise<Order[]> {
    const db = await getDB();
    return db.getAll('orders');
  },

  async getOrder(id: string): Promise<Order | undefined> {
    const db = await getDB();
    return db.get('orders', id);
  },

  async saveOrder(order: Order): Promise<void> {
    const db = await getDB();
    // CRITICAL: Save to IndexedDB FIRST - this always works, even offline
    // This ensures we never lose an order, even if Supabase sync fails
    await db.put('orders', order);
    
    // Sync to Supabase in background (fire-and-forget)
    // If this fails, the order is still safely saved in IndexedDB
    syncToSupabase(async () => {
      try {
        await supabaseFetch('/api/supabase/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
        });
        // If sync succeeds, update status to 'synced'
        if (order.status === 'submitted') {
          const syncedOrder = { ...order, status: 'synced' as const };
          await db.put('orders', syncedOrder);
        }
      } catch (error) {
        // Order is already saved in IndexedDB, so we just log the error
        console.warn('Failed to sync order to Supabase (order is saved locally):', error);
      }
    }).catch((error) => {
      // Even if syncToSupabase wrapper fails, order is safe in IndexedDB
      console.warn('Supabase sync error (order is saved locally):', error);
    });
  },

  async deleteOrder(orderId: string): Promise<void> {
    const db = await getDB();
    await db.delete('orders', orderId);
    // Sync to Supabase in background
    await syncToSupabase(async () => {
      await supabaseFetch(`/api/supabase/orders/${encodeURIComponent(orderId)}`, {
        method: 'DELETE',
      });
    });
  },

  async getDraftOrders(): Promise<Order[]> {
    const db = await getDB();
    return db.getAllFromIndex('orders', 'by-status', 'draft');
  },

  // Get orders that need to be synced to Supabase (submitted but not yet synced)
  async getUnsyncedOrders(): Promise<Order[]> {
    const db = await getDB();
    const submitted = await db.getAllFromIndex('orders', 'by-status', 'submitted');
    return submitted;
  },

  // Retry syncing unsynced orders to Supabase
  async retrySyncOrders(): Promise<{ synced: number; failed: number }> {
    const unsynced = await this.getUnsyncedOrders();
    let synced = 0;
    let failed = 0;

    for (const order of unsynced) {
      try {
        await supabaseFetch('/api/supabase/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order }),
        });
        // Update status to synced
        const syncedOrder = { ...order, status: 'synced' as const };
        const db = await getDB();
        await db.put('orders', syncedOrder);
        synced++;
      } catch (error) {
        console.warn(`Failed to sync order ${order.id}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  },

  // Metadata (for app settings)
  async getLastSyncTime(): Promise<Date | null> {
    const db = await getDB();
    const metadata = await db.get('metadata', 'lastSyncTime');
    return metadata?.value ? new Date(metadata.value) : null;
  },

  async setLastSyncTime(): Promise<void> {
    const db = await getDB();
    await db.put('metadata', {
      key: 'lastSyncTime',
      value: new Date().toISOString(),
    });
  },

  // Leads
  async saveLead(lead: Lead): Promise<void> {
    const db = await getDB();
    await db.put('leads', lead);
  },

  async getLeads(): Promise<Lead[]> {
    const db = await getDB();
    return db.getAll('leads');
  },

  async deleteLead(leadId: string): Promise<void> {
    const db = await getDB();
    await db.delete('leads', leadId);
  },
};
