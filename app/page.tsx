'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { netsuiteClient } from '@/lib/netsuite-client';
import CustomerSearch from '@/components/CustomerSearch';
import OrderFlow from '@/components/OrderFlow';
import OrderList from '@/components/OrderList';
import LeadInfo from '@/components/LeadInfo';
import SyncButton from '@/components/SyncButton';
import { Customer, Order } from '@/lib/supabase';

type Section = 'order-entry' | 'lead-info';

export default function Home() {
  const [currentSection, setCurrentSection] = useState<Section>('order-entry');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [showOrderList, setShowOrderList] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [salesRepId, setSalesRepId] = useState<string | null>(null);
  const [unsyncedCounts, setUnsyncedCounts] = useState({ customers: 0, contacts: 0, addresses: 0 });
  const [showSyncWarning, setShowSyncWarning] = useState(false);

  useEffect(() => {
    // Check authentication
    checkAuth();
    // Load initial data on mount
    loadInitialData();
    loadLastSyncTime();
    
    // Set initial online status
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    
    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online if there are unsynced orders
      autoSyncOnReconnect();
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/check');
      if (response.ok) {
        const data = await response.json();
        setUsername(data.user?.username || null);
        setSalesRepId(data.user?.salesRepId || null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loadLastSyncTime = async () => {
    const time = await storage.getLastSyncTime();
    setLastSyncTime(time);
  };

  const autoSyncOnReconnect = async () => {
    // Only auto-sync if we're not already syncing
    if (syncStatus !== 'idle') return;
    
    console.log('=== Auto-sync on reconnect: Starting ===');
    try {
      // Step 1: Retry syncing customers first (contacts and addresses depend on customer having netsuite_id)
      const unsyncedCustomers = await storage.getUnsyncedCustomers();
      if (unsyncedCustomers.length > 0) {
        console.log(`Found ${unsyncedCustomers.length} unsynced customers, attempting to push to NetSuite...`);
        const customerResult = await storage.retrySyncCustomers();
        console.log(`Customer sync result: ${customerResult.synced} synced, ${customerResult.failed} failed`);
      } else {
        console.log('No unsynced customers found');
      }

      // Step 2: Retry syncing contacts (depends on customer having netsuite_id)
      const unsyncedContacts = await storage.getUnsyncedContacts();
      if (unsyncedContacts.length > 0) {
        console.log(`Found ${unsyncedContacts.length} unsynced contacts, attempting to push to NetSuite...`);
        const contactResult = await storage.retrySyncContacts();
        console.log(`Contact sync result: ${contactResult.synced} synced, ${contactResult.failed} failed`);
      } else {
        console.log('No unsynced contacts found');
      }

      // Step 3: Retry syncing addresses (depends on customer having netsuite_id)
      const unsyncedAddresses = await storage.getUnsyncedAddresses();
      if (unsyncedAddresses.length > 0) {
        console.log(`Found ${unsyncedAddresses.length} unsynced addresses, attempting to push to NetSuite...`);
        const addressResult = await storage.retrySyncAddresses();
        console.log(`Address sync result: ${addressResult.synced} synced, ${addressResult.failed} failed`);
      } else {
        console.log('No unsynced addresses found');
      }
      
      // Note: Orders are pushed manually only, not as part of auto-sync
      
      console.log('=== Auto-sync on reconnect: Complete ===');
    } catch (error) {
      console.error('Auto-sync on reconnect failed:', error);
    }
  };

  const loadUnsyncedCounts = async () => {
    try {
      const unsyncedCustomers = await storage.getUnsyncedCustomers();
      const unsyncedContacts = await storage.getUnsyncedContacts();
      const unsyncedAddresses = await storage.getUnsyncedAddresses();
      setUnsyncedCounts({
        customers: unsyncedCustomers.length,
        contacts: unsyncedContacts.length,
        addresses: unsyncedAddresses.length,
      });
    } catch (error) {
      console.error('Error loading unsynced counts:', error);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Check if we have data in IndexedDB
      const customers = await storage.getCustomers();
      const items = await storage.getItems();
      
      if (customers.length === 0 || items.length === 0) {
        // No data, user will need to sync
        console.log('No local data found. Please sync to download customers and items.');
      }
      
      // Load unsynced counts
      await loadUnsyncedCounts();
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    // Create a new order for this customer
    const newOrder: Order = {
      id: `order-${Date.now()}`,
      customer_id: customer.id,
      items: [],
      status: 'draft',
      created_by: username || undefined,
      created_at: new Date().toISOString(),
    };
    setCurrentOrder(newOrder);
  };

  const handleOrderComplete = async (order: Order) => {
    // Mark order as submitted and ensure it's saved to IndexedDB first
    const completedOrder: Order = {
      ...order,
      status: 'submitted', // Changed from 'draft' to 'submitted'
      synced_at: new Date().toISOString(),
    };
    
    // Save to IndexedDB first (this always works, even offline)
    await storage.saveOrder(completedOrder);
    
    // Clear UI - order is safely saved locally
    setCurrentOrder(null);
    setSelectedCustomer(null);
    
    // Show success message
    alert('Order saved successfully! It will be synced to the server when online.');
  };

  const handleEditOrder = async (order: Order) => {
    try {
      console.log('handleEditOrder called with order:', {
        orderId: order.id,
        customerId: order.customer_id,
        itemsCount: order.items.length
      });

      if (!order.customer_id) {
        console.error('Order missing customer_id:', order);
        alert('Cannot edit order: Order is missing customer information');
        return;
      }

      // Load the customer for this order
      const customer = await storage.getCustomer(order.customer_id);
      if (customer) {
        console.log('Customer loaded for order:', customer.companyname);
        setSelectedCustomer(customer);
        setCurrentOrder(order);
      } else {
        console.error('Customer not found for order:', {
          orderId: order.id,
          customerId: order.customer_id
        });
        alert(`Could not load customer for this order. Customer ID: ${order.customer_id}`);
      }
    } catch (error) {
      console.error('Error in handleEditOrder:', error);
      alert(`Failed to open order for editing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatLastSyncTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSync = async () => {
    // Check if there are unsynced records and show warning
    const totalUnsynced = unsyncedCounts.customers + unsyncedCounts.contacts + unsyncedCounts.addresses;
    if (totalUnsynced > 0) {
      setShowSyncWarning(true);
      return;
    }
    
    performSync();
  };

  const performSync = async () => {
    setShowSyncWarning(false);
    setSyncStatus('syncing');
    try {
      // Clear all customers, contacts, and addresses before re-syncing
      // This ensures deletions in NetSuite are reflected locally
      // WARNING: This will also delete any local-only records (created offline but not yet synced)
      await storage.clearCustomersContactsAndAddresses();

      // Sync customers first (needed for mapping contacts and addresses)
      const customers = await netsuiteClient.getCustomers();
      const customersToSave = customers.map((c: any) => ({
        id: `customer-${c.id}`,
        netsuite_id: c.id.toString(),
        entityid: c.entityid || '',
        companyname: c.companyname || '',
        email: c.email || '',
        partner: c.partner ? c.partner.toString() : undefined,
        pricelevel: c.pricelevel ? c.pricelevel.toString() : undefined,
        synced_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));
      await storage.saveCustomers(customersToSave);

      // Create a map of netsuite_id -> customer id for lookups
      const customerMap = new Map<string, string>();
      customersToSave.forEach((c) => {
        if (c.netsuite_id) {
          customerMap.set(c.netsuite_id, c.id);
        }
      });

      // Sync contacts
      const contactsData = await netsuiteClient.getAllContacts();
      const contactsToSave = contactsData.map((row: any) => {
        // Convert customer_id to string to match the map key (netsuite_id is stored as string)
        const netsuiteCustomerId = String(row.customer_id || '');
        const customerId = customerMap.get(netsuiteCustomerId);
        if (!customerId) {
          console.warn(`Customer not found for contact. NetSuite customer_id: ${netsuiteCustomerId}, Contact ID: ${row.contact_id}`);
          return null;
        }
        return {
          id: `contact-${row.contact_id}`,
          customer_id: customerId,
          netsuite_id: row.contact_id?.toString(),
          entityid: row.contact_entityid || `${row.firstname || ''} ${row.lastname || ''}`.trim() || `contact-${row.contact_id}`,
          firstname: row.firstname || '',
          lastname: row.lastname || '',
          email: row.email || '',
          phone: row.phone || '',
          title: '',
          synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      }).filter((c): c is NonNullable<typeof c> => c !== null);
      await storage.saveContacts(contactsToSave);

      // Sync addresses
      const addressesData = await netsuiteClient.getAllAddresses();
      const addressesToSave = addressesData.map((row: any) => {
        // Convert customer_id to string to match the map key (netsuite_id is stored as string)
        const netsuiteCustomerId = String(row.customer_id || '');
        const customerId = customerMap.get(netsuiteCustomerId);
        if (!customerId) {
          console.warn(`Customer not found for address. NetSuite customer_id: ${netsuiteCustomerId}, Available keys:`, Array.from(customerMap.keys()).slice(0, 5));
          return null;
        }

        // Address fields are now directly in the row from the JOIN
        const addr1 = row.addr1 || '';
        const addr2 = row.addr2 || '';
        const city = row.city || '';
        const state = row.state || '';
        const zip = row.zip || '';
        const country = row.country || '';
        const addressee = row.addressee || row.label || '';

        // Combine address fields into addrtext for display
        const addrParts = [
          addr1,
          addr2,
          city ? `${city}, ${state || ''} ${zip || ''}`.trim() : '',
          country
        ].filter(Boolean);
        const addrtext = addrParts.join(', ') || row.label || 'Address';

        // Create a unique ID using customer_id, label, and address fields to avoid duplicates
        // Multiple addresses can have the same label, so we need to include address fields
        const addressKey = `${row.customer_id}-${row.label || 'unnamed'}-${addr1}-${city}-${zip}`.replace(/[^a-zA-Z0-9-]/g, '-');
        const netsuiteId = `addr-${addressKey}`;

        return {
          id: `address-${netsuiteId}`,
          customer_id: customerId,
          netsuite_id: netsuiteId,
          addr1: addr1,
          addr2: addr2,
          city: city,
          state: state,
          zip: zip,
          country: country,
          addressee: addressee,
          addrtext: addrtext,
          type: (row.defaultshipping === 'T' ? 'ship' : row.defaultbilling === 'T' ? 'bill' : undefined) as 'ship' | 'bill' | undefined,
          synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };
      }).filter((a): a is NonNullable<typeof a> => a !== null);
      
      // Remove duplicates by ID before saving (in case same address appears multiple times)
      // Use a Map to keep the first occurrence of each unique ID
      const addressMap = new Map<string, typeof addressesToSave[0]>();
      for (const addr of addressesToSave) {
        if (!addressMap.has(addr.id)) {
          addressMap.set(addr.id, addr);
        }
      }
      const uniqueAddresses = Array.from(addressMap.values());
      
      console.log(`Syncing ${uniqueAddresses.length} unique addresses (${addressesToSave.length} total before deduplication)`);
      await storage.saveAddresses(uniqueAddresses);

      // Sync items - group by item id since query returns multiple rows per item (one per pricelevel)
      const itemsData = await netsuiteClient.getItems();
      const itemsMap = new Map<string, any>();
      const { mapNetSuiteQtyToQuantity } = await import('@/lib/price-calculator');
      
      itemsData.forEach((row: any) => {
        const itemId = row.id.toString();
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, {
            id: `item-${row.id}`,
            netsuite_id: itemId,
            itemid: row.itemid || '',
            displayname: row.displayname || '',
            color: row.custitem_item_color || undefined,
            size: row.custitem_item_size || undefined,
            price_breaks: {},
            quantityavailable: 0,
            synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          });
        }
        
        const item = itemsMap.get(itemId)!;
        const pricelevel = row.pricelevel?.toString();
        const priceBreakQty = parseInt(row.price_break_qty || '1', 10);
        const price = parseFloat(row.price) || 0;
        
        // Map NetSuite price_break_qty to actual quantity and store the price
        if (price > 0 && pricelevel) {
          if (!item.price_breaks[pricelevel]) {
            item.price_breaks[pricelevel] = [];
          }
          
          const actualQuantity = mapNetSuiteQtyToQuantity(priceBreakQty);
          
          // Check if we already have this quantity break (shouldn't happen, but just in case)
          const existingIndex = item.price_breaks[pricelevel].findIndex(
            (pb: any) => pb.quantity === actualQuantity
          );
          
          if (existingIndex >= 0) {
            // Update existing break (shouldn't happen, but handle it)
            item.price_breaks[pricelevel][existingIndex].price = price;
          } else {
            // Add new price break
            item.price_breaks[pricelevel].push({
              quantity: actualQuantity,
              price: price,
            });
          }
        }
      });
      
      // Sort price breaks by quantity for each price level
      itemsMap.forEach((item) => {
        Object.keys(item.price_breaks).forEach((priceLevel) => {
          item.price_breaks[priceLevel].sort((a: any, b: any) => a.quantity - b.quantity);
        });
      });
      
      const itemsToSave = Array.from(itemsMap.values());
      await storage.saveItems(itemsToSave);

      // Retry syncing any orders that failed to sync previously
      const retryResult = await storage.retrySyncOrders();
      if (retryResult.synced > 0) {
        console.log(`Retried and synced ${retryResult.synced} previously failed orders`);
      }
      if (retryResult.failed > 0) {
        console.warn(`${retryResult.failed} orders still failed to sync (they're safe in IndexedDB)`);
      }

      // Save last sync time
      await storage.setLastSyncTime();
      await loadLastSyncTime();
      await loadUnsyncedCounts(); // Refresh unsynced counts after sync

      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 2000);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const isOrderEntrySection = currentSection === 'order-entry';
  const isLeadInfoSection = currentSection === 'lead-info';

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      {showOrderList ? (
        <OrderList 
          onClose={() => setShowOrderList(false)} 
          onEditOrder={handleEditOrder}
          isOnline={isOnline}
        />
      ) : currentSection === 'lead-info' ? (
        <>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentSection('order-entry')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isOrderEntrySection
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Order Entry
                </button>
                <button
                  onClick={() => setCurrentSection('lead-info')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isLeadInfoSection
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Lead Info
                </button>
              </div>
              <div className="flex items-center gap-3">
                {/* Online/Offline Status Indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isOnline 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
                {username && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{username}</span>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <LeadInfo username={username} isOnline={isOnline} />
        </>
      ) : !selectedCustomer ? (
        <>
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentSection('order-entry')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isOrderEntrySection
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Order Entry
                </button>
                <button
                  onClick={() => setCurrentSection('lead-info')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isLeadInfoSection
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Lead Info
                </button>
              </div>
              <div className="flex items-center gap-3">
                {/* Online/Offline Status Indicator */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isOnline 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
                <button
                  onClick={() => setShowOrderList(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  View Orders
                </button>
                <SyncButton onSync={handleSync} status={syncStatus} />
                {unsyncedCounts.customers + unsyncedCounts.contacts + unsyncedCounts.addresses > 0 && (
                  <div className="text-sm text-yellow-600 font-medium">
                    Pending: {unsyncedCounts.customers} customer{unsyncedCounts.customers !== 1 ? 's' : ''}
                    {unsyncedCounts.contacts > 0 && `, ${unsyncedCounts.contacts} contact${unsyncedCounts.contacts !== 1 ? 's' : ''}`}
                    {unsyncedCounts.addresses > 0 && `, ${unsyncedCounts.addresses} address${unsyncedCounts.addresses !== 1 ? 'es' : ''}`}
                  </div>
                )}
                {lastSyncTime && (
                  <div className="text-sm text-gray-600">
                    Last synced: {formatLastSyncTime(lastSyncTime)}
                  </div>
                )}
                {username && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{username}</span>
                    <button
                      onClick={handleLogout}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <CustomerSearch 
            onSelect={handleCustomerSelect} 
            salesRepId={salesRepId}
            isOnline={isOnline}
            onEditOrder={handleEditOrder}
          />
        </>
      ) : currentOrder ? (
        <OrderFlow
          customer={selectedCustomer}
          order={currentOrder}
          onComplete={handleOrderComplete}
          onCancel={() => {
            setSelectedCustomer(null);
            setCurrentOrder(null);
          }}
          isOnline={isOnline}
          syncStatus={syncStatus}
          onSync={handleSync}
          onViewOrders={() => setShowOrderList(true)}
          lastSyncTime={lastSyncTime}
        />
      ) : null}

      {/* Sync Warning Dialog */}
      {showSyncWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Warning: Unsaved Data</h2>
            <p className="text-gray-700 mb-4">
              You have {unsyncedCounts.customers + unsyncedCounts.contacts + unsyncedCounts.addresses} unsynced record(s) that will be lost:
            </p>
            <ul className="list-disc list-inside mb-4 text-gray-700 space-y-1">
              {unsyncedCounts.customers > 0 && (
                <li>{unsyncedCounts.customers} customer{unsyncedCounts.customers !== 1 ? 's' : ''}</li>
              )}
              {unsyncedCounts.contacts > 0 && (
                <li>{unsyncedCounts.contacts} contact{unsyncedCounts.contacts !== 1 ? 's' : ''}</li>
              )}
              {unsyncedCounts.addresses > 0 && (
                <li>{unsyncedCounts.addresses} address{unsyncedCounts.addresses !== 1 ? 'es' : ''}</li>
              )}
            </ul>
            <p className="text-gray-700 mb-6">
              Syncing will clear all customers, contacts, and addresses and replace them with data from NetSuite. 
              These unsynced records will be permanently lost.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSyncWarning(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={performSync}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                Sync Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

