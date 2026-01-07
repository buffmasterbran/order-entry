'use client';

import { useState } from 'react';
import { Address } from '@/lib/supabase';

interface AddressFormProps {
  customerId: string;
  onSave: (address: Address) => void;
}

export default function AddressForm({ customerId, onSave }: AddressFormProps) {
  const [formData, setFormData] = useState({
    addressee: '',
    addr1: '',
    addr2: '',
    city: '',
    state: '',
    zip: '',
    country: 'US',
    isDefaultShipping: false,
    isDefaultBilling: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Determine type based on checkboxes - if both checked, prioritize shipping
    const type: 'ship' | 'bill' | undefined = formData.isDefaultShipping ? 'ship' : formData.isDefaultBilling ? 'bill' : undefined;
    
    const address: any = {
      id: `address-${Date.now()}`,
      customer_id: customerId,
      type,
      addressee: formData.addressee.trim() || undefined,
      addr1: formData.addr1.trim() || undefined,
      addr2: formData.addr2.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      zip: formData.zip.trim() || undefined,
      country: formData.country.trim() || undefined,
      created_at: new Date().toISOString(),
      // Store checkbox values for NetSuite push
      isDefaultShipping: formData.isDefaultShipping,
      isDefaultBilling: formData.isDefaultBilling,
    };
    console.log('AddressForm - formData:', formData);
    console.log('AddressForm - address object being saved:', address);
    onSave(address);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Addressee
        </label>
        <input
          type="text"
          value={formData.addressee}
          onChange={(e) => setFormData({ ...formData, addressee: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Company or Name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 1
        </label>
        <input
          type="text"
          value={formData.addr1}
          onChange={(e) => setFormData({ ...formData, addr1: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Address Line 2
        </label>
        <input
          type="text"
          value={formData.addr2}
          onChange={(e) => setFormData({ ...formData, addr2: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            City
          </label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={2}
            placeholder="CA"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ZIP Code
          </label>
          <input
            type="text"
            value={formData.zip}
            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Country
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-6 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isDefaultShipping}
            onChange={(e) => setFormData({ ...formData, isDefaultShipping: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Default Shipping</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isDefaultBilling}
            onChange={(e) => setFormData({ ...formData, isDefaultBilling: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Default Billing</span>
        </label>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Create Address
        </button>
      </div>
    </form>
  );
}

