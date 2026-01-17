'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, User } from 'lucide-react';
import { storage } from '@/lib/storage';
import { Customer, Order } from '@/lib/supabase';
import CustomerForm from './CustomerForm';
import OrderHistoryDialog from './OrderHistoryDialog';

interface CustomerSearchProps {
  onSelect: (customer: Customer) => void;
  salesRepId?: string | null; // If provided, filter customers by this sales rep. If null/undefined, show all.
  isOnline?: boolean;
  onEditOrder?: (order: Order) => void;
}

export default function CustomerSearch({ onSelect, salesRepId, isOnline = true, onEditOrder }: CustomerSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [orderHistoryCustomer, setOrderHistoryCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    loadCustomers();
  }, [salesRepId]); // Reload when salesRepId changes

  const loadCustomers = async () => {
    const allCustomers = await storage.getCustomers();
    // Filter by sales rep if salesRepId is provided
    // If salesRepId is null/undefined, show all customers (full access)
    // Convert both to string for comparison (partner might be stored as number or string)
    const filteredCustomers = salesRepId 
      ? allCustomers.filter(c => String(c.partner) === String(salesRepId))
      : allCustomers;
    setCustomers(filteredCustomers);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      const allCustomers = await storage.getCustomers();
      // Filter by sales rep if salesRepId is provided
      // Convert both to string for comparison (partner might be stored as number or string)
      const filteredCustomers = salesRepId 
        ? allCustomers.filter(c => String(c.partner) === String(salesRepId))
        : allCustomers;
      setCustomers(filteredCustomers);
      return;
    }

    setIsSearching(true);
    const results = await storage.searchCustomers(query);
    // Filter by sales rep if salesRepId is provided
    // Convert both to string for comparison (partner might be stored as number or string)
    const filteredResults = salesRepId 
      ? results.filter(c => String(c.partner) === String(salesRepId))
      : results;
    setCustomers(filteredResults);
    setIsSearching(false);
  };

  const handleCustomerCreated = async (customer: Customer) => {
    await storage.saveCustomer(customer);
    await loadCustomers();
    setShowCreateForm(false);
    onSelect(customer);
  };

  if (showCreateForm) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Create New Customer</h2>
          <button
            onClick={() => setShowCreateForm(false)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
        <CustomerForm onSave={handleCustomerCreated} />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search customers by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          New Customer
        </button>
      </div>

      {isSearching ? (
        <div className="text-center py-8 text-gray-500">Searching...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {searchQuery ? 'No customers found. Create a new one?' : 'No customers loaded. Click Sync to download from NetSuite.'}
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
            >
              <button
                onClick={() => onSelect(customer)}
                className="flex-1 text-left flex items-center gap-3"
              >
                <div className="bg-blue-100 rounded-full p-2">
                  <User size={20} className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg">{customer.companyname}</div>
                  <div className="text-sm text-gray-600">
                    {customer.entityid} {customer.email && `• ${customer.email}`}
                  </div>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOrderHistoryCustomer(customer);
                }}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-blue-100 hover:text-blue-600 rounded-lg transition-colors font-medium"
                title="View order history"
              >
                Order History
              </button>
            </div>
          ))}
        </div>
      )}
      {orderHistoryCustomer && (
        <OrderHistoryDialog
          customer={orderHistoryCustomer}
          onClose={() => setOrderHistoryCustomer(null)}
          onEditOrder={onEditOrder}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}

