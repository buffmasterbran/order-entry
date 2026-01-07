'use client';

import { useState } from 'react';
import { Customer } from '@/lib/supabase';

interface CustomerFormProps {
  onSave: (customer: Customer) => void;
}

const CUSTOMER_CATEGORIES = [
  { id: '19', label: '1. Promotional and Events' },
  { id: '32', label: '1. Amazon' },
  { id: '28', label: '1. Direct to Consumer' },
  { id: '34', label: '1. Food and Beverage' },
  { id: '1', label: '1. Gift Shops - General' },
  { id: '5', label: '1. Golf / Tennis / Sports Club' },
  { id: '9', label: '1. Low Margin Strategic Sale (Music Festival, Flash Sale, ect)' },
  { id: '36', label: '1. Other' },
  { id: '18', label: '1. Partnership/Friend' },
];

const CUSTOMER_SOURCES = [
  { id: '3', label: 'Surf Expo Summer' },
  { id: '4', label: 'Surf Expo Winter' },
  { id: '27', label: 'PPAI' },
  { id: '14', label: 'PGA Show' },
];

export default function CustomerForm({ onSave }: CustomerFormProps) {
  const [formData, setFormData] = useState({
    companyname: '',
    email: '',
    subsidiary: '2', // Default subsidiary
    partner: '54690', // Default Rep
    customerCategory: '',
    priceLevel: '4', // Default Price Level
    customerSalesChannel: '6', // Default Sales Channel
    customerSource: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Entity ID is auto-generated - will be set by NetSuite when synced
    // For local-only customers, we generate a temporary one
    const customer: any = {
      id: `customer-${Date.now()}`,
      entityid: `CUST-${Date.now()}`, // Auto-generated, will be replaced by NetSuite entityid when synced
      companyname: formData.companyname,
      email: formData.email || undefined,
      created_at: new Date().toISOString(),
      // NetSuite required fields
      subsidiary: formData.subsidiary || undefined,
      partner: formData.partner || undefined,
      customerCategory: formData.customerCategory || undefined,
      priceLevel: formData.priceLevel || undefined,
      customerSalesChannel: formData.customerSalesChannel || undefined,
      customerSource: formData.customerSource || undefined,
    };
    onSave(customer);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company Name *
        </label>
        <input
          type="text"
          required
          value={formData.companyname}
          onChange={(e) => setFormData({ ...formData, companyname: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter company name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email
        </label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="customer@example.com"
        />
      </div>

      {/* Hidden fields with defaults */}
      <input type="hidden" value={formData.subsidiary} />
      <input type="hidden" value={formData.partner} />
      <input type="hidden" value={formData.priceLevel} />
      <input type="hidden" value={formData.customerSalesChannel} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Category *
        </label>
        <select
          required
          value={formData.customerCategory}
          onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a category</option>
          {CUSTOMER_CATEGORIES.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>


      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Source *
        </label>
        <select
          required
          value={formData.customerSource}
          onChange={(e) => setFormData({ ...formData, customerSource: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a source</option>
          {CUSTOMER_SOURCES.map((source) => (
            <option key={source.id} value={source.id}>
              {source.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Create Customer
        </button>
      </div>
    </form>
  );
}

