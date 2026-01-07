'use client';

import { useState, useEffect } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { Address } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { netsuiteClient } from '@/lib/netsuite-client';
import AddressForm from './AddressForm';

interface AddressSelectorProps {
  addresses: Address[];
  selectedShipId?: string;
  selectedBillId?: string;
  onSelect: (shipAddress: Address | null, billAddress: Address | null) => void;
  customerId: string;
  onAddressesUpdated?: () => void;
}

export default function AddressSelector({
  addresses,
  selectedShipId,
  selectedBillId,
  onSelect,
  customerId,
  onAddressesUpdated,
}: AddressSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  // Local state for selections (allows user to select both before continuing)
  const [localShipId, setLocalShipId] = useState<string | undefined>(selectedShipId);
  const [localBillId, setLocalBillId] = useState<string | undefined>(selectedBillId);

  const handleLoadFromNetSuite = async () => {
    setLoading(true);
    try {
      const customer = await storage.getCustomer(customerId);
      if (customer?.netsuite_id) {
        const nsAddresses = await netsuiteClient.getCustomerAddresses(customer.netsuite_id);
        const addressesToSave = nsAddresses.map((a: any) => {
          // Combine address fields into addrtext for display
          const addrParts = [
            a.address1,
            a.address2,
            a.city ? `${a.city}, ${a.state || ''} ${a.zip || ''}`.trim() : '',
            a.country
          ].filter(Boolean);
          const addrtext = addrParts.join(', ');
          
          return {
            id: `address-${a.id}`,
            customer_id: customerId,
            netsuite_id: a.id.toString(),
            addr1: a.address1 || '',
            addr2: a.address2 || '',
            city: a.city || '',
            state: a.state || '',
            zip: a.zip || '',
            country: a.country || '',
            addressee: '', // Not available in the query
            addrtext: addrtext,
            synced_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
        });
        await storage.saveAddresses(addressesToSave);
        // Refresh addresses
        if (onAddressesUpdated) onAddressesUpdated();
      }
    } catch (error) {
      console.error('Error loading addresses from NetSuite:', error);
      alert('Failed to load addresses from NetSuite. Make sure you are online and synced.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressCreated = async (address: Address) => {
    await storage.saveAddress(address);
    setShowCreateForm(false);
    // Select the newly created address as ship address (and bill if no bill address is set)
    setLocalShipId(address.id);
    if (!localBillId) {
      setLocalBillId(address.id);
    }
    // Get updated addresses list and notify parent
    const updatedAddresses = await storage.getCustomerAddresses(customerId);
    const selectedShip = address;
    const selectedBill = !localBillId ? address : updatedAddresses.find((a) => a.id === localBillId) || null;
    onSelect(selectedShip, selectedBill);
    // Refresh addresses in parent component
    if (onAddressesUpdated) {
      await onAddressesUpdated();
    }
  };

  // Sync local state with props when they change
  useEffect(() => {
    setLocalShipId(selectedShipId);
    setLocalBillId(selectedBillId);
  }, [selectedShipId, selectedBillId]);

  // Use local state for selection display
  const shipAddress = addresses.find((a) => a.id === localShipId);
  const billAddress = addresses.find((a) => a.id === localBillId);

  const handleShipSelect = (address: Address | null) => {
    setLocalShipId(address?.id);
  };

  const handleBillSelect = (address: Address | null) => {
    setLocalBillId(address?.id);
  };

  const handleContinue = () => {
    const selectedShip = addresses.find((a) => a.id === localShipId) || null;
    const selectedBill = addresses.find((a) => a.id === localBillId) || null;
    onSelect(selectedShip, selectedBill);
  };

  if (showCreateForm) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Create New Address</h3>
          <button
            onClick={() => setShowCreateForm(false)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
        <AddressForm customerId={customerId} onSave={handleAddressCreated} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Select Addresses</h3>
        <div className="flex gap-2">
          <button
            onClick={handleLoadFromNetSuite}
            disabled={loading}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
          >
            {loading ? 'Loading...' : 'Load from NetSuite'}
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={16} />
            New Address
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Ship To */}
        <div>
          <h4 className="font-semibold mb-3">Ship To</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleShipSelect(null)}
              className={`w-full text-left p-3 border rounded-lg transition-colors ${
                !localShipId
                  ? 'bg-blue-50 border-blue-300'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" />
                <span className="text-sm">No Address</span>
              </div>
            </button>
            {addresses.map((address) => (
              <button
                key={address.id}
                onClick={() => handleShipSelect(address)}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  localShipId === address.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-blue-600 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{address.addressee || 'Address'}</div>
                    <div className="text-gray-600">
                      {address.addrtext || `${address.addr1}, ${address.city}, ${address.state} ${address.zip}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bill To */}
        <div>
          <h4 className="font-semibold mb-3">Bill To</h4>
          <div className="space-y-2">
            <button
              onClick={() => handleBillSelect(null)}
              className={`w-full text-left p-3 border rounded-lg transition-colors ${
                !localBillId
                  ? 'bg-blue-50 border-blue-300'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-gray-400" />
                <span className="text-sm">No Address</span>
              </div>
            </button>
            {addresses.map((address) => (
              <button
                key={address.id}
                onClick={() => handleBillSelect(address)}
                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                  localBillId === address.id
                    ? 'bg-blue-50 border-blue-300'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-blue-600 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{address.addressee || 'Address'}</div>
                    <div className="text-gray-600">
                      {address.addrtext || `${address.addr1}, ${address.city}, ${address.state} ${address.zip}`}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <button
          onClick={handleContinue}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

