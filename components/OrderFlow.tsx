'use client';

import { useState, useEffect } from 'react';
import { User, MapPin, Package, FileText, Check, ArrowRight } from 'lucide-react';
import { Customer, Order, Contact, Address, OrderItem } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import ContactSelector from './ContactSelector';
import AddressSelector from './AddressSelector';
import ItemSelector from './ItemSelector';

interface OrderFlowProps {
  customer: Customer | null;
  order: Order;
  onComplete: (order: Order) => void;
  onCancel: () => void;
  isOnline?: boolean;
  syncStatus?: 'idle' | 'syncing' | 'success' | 'error';
  onSync?: () => void;
  onViewOrders?: () => void;
  lastSyncTime?: Date | null;
}

type Step = 'contact' | 'address' | 'items' | 'review';

export default function OrderFlow({
  customer,
  order,
  onComplete,
  onCancel,
  isOnline = true,
  syncStatus = 'idle',
  onViewOrders,
  lastSyncTime,
}: OrderFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('contact');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedShipAddress, setSelectedShipAddress] = useState<Address | null>(null);
  const [selectedBillAddress, setSelectedBillAddress] = useState<Address | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>(order.items || []);
  const [shipDate, setShipDate] = useState<string>(order.ship_date || '');
  const [notes, setNotes] = useState<string>(order.notes || '');
  const [creditCard, setCreditCard] = useState(order.credit_card || { name: '', number: '', expiry: '', cvv: '' });

  useEffect(() => {
    if (customer) {
      loadContactsAndAddresses();
    }
  }, [customer]);

  useEffect(() => {
    // Load selected contact/addresses from order
    if (order.contact_id && customer) {
      storage.getCustomerContacts(customer.id).then((contacts) => {
        const contact = contacts.find((c) => c.id === order.contact_id);
        if (contact) setSelectedContact(contact);
      });
    }
    if (order.ship_address_id && customer) {
      storage.getCustomerAddresses(customer.id).then((addresses) => {
        const address = addresses.find((a) => a.id === order.ship_address_id);
        if (address) setSelectedShipAddress(address);
      });
    }
    if (order.bill_address_id && customer) {
      storage.getCustomerAddresses(customer.id).then((addresses) => {
        const address = addresses.find((a) => a.id === order.bill_address_id);
        if (address) setSelectedBillAddress(address);
      });
    }
  }, [order, customer]);

  const loadContactsAndAddresses = async () => {
    if (!customer) return;
    try {
      const [contactsData, addressesData] = await Promise.all([
        storage.getCustomerContacts(customer.id),
        storage.getCustomerAddresses(customer.id),
      ]);
      setContacts(contactsData);
      setAddresses(addressesData);
    } catch (error) {
      console.error('Error loading contacts/addresses:', error);
    }
  };

  const handleStepClick = (step: Step) => {
    if (step === 'contact' || currentStep === 'contact') {
      setCurrentStep(step);
    } else if (step === 'address' && selectedContact) {
      setCurrentStep(step);
    } else if (step === 'items' && selectedShipAddress) {
      setCurrentStep(step);
    } else if (step === 'review' && orderItems.length > 0) {
      setCurrentStep(step);
    }
  };

  const handleComplete = async () => {
    const updatedOrder: Order = {
      ...order,
      contact_id: selectedContact?.id,
      ship_address_id: selectedShipAddress?.id,
      bill_address_id: selectedBillAddress?.id || selectedShipAddress?.id,
      items: orderItems,
      ship_date: shipDate,
      notes: notes,
      credit_card: creditCard,
      status: 'draft' as const,
    };
    await storage.saveOrder(updatedOrder);
    onComplete(updatedOrder);
  };

  const steps: { id: Step; label: string; icon: any }[] = [
    { id: 'contact', label: 'Contact', icon: User },
    { id: 'address', label: 'Address', icon: MapPin },
    { id: 'items', label: 'Items', icon: Package },
    { id: 'review', label: 'Review', icon: FileText },
  ];

  const canNavigate = (step: Step) => {
    const stepIndex = steps.findIndex((s) => s.id === step);
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    return stepIndex <= currentIndex || stepIndex === currentIndex + 1;
  };

  const getItemPrice = (item: OrderItem) => {
    return (item.quantity || 0) * (item.price || 0);
  };

  const getOrderTotal = () => {
    return orderItems.reduce((sum, item) => sum + getItemPrice(item), 0);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with steps */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Create Order</h1>
            <button
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = steps.findIndex((s) => s.id === currentStep) > index;
              const canClick = canNavigate(step.id);

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => canClick && handleStepClick(step.id)}
                    disabled={!canClick}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-green-100 text-green-800'
                        : canClick
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{step.label}</span>
                  </button>
                  {index < steps.length - 1 && (
                    <ArrowRight size={16} className="mx-2 text-gray-400" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto px-6">
        {currentStep === 'contact' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Select Contact</h2>
            {customer && (
              <ContactSelector
                contacts={contacts}
                selectedId={selectedContact?.id}
                onSelect={(contact) => {
                  setSelectedContact(contact);
                  if (contact) handleStepClick('address');
                }}
                customerId={customer.id}
                onContactsUpdated={loadContactsAndAddresses}
              />
            )}
          </div>
        )}

        {currentStep === 'address' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Select Addresses</h2>
            {customer && (
              <AddressSelector
                addresses={addresses}
                selectedShipId={selectedShipAddress?.id}
                selectedBillId={selectedBillAddress?.id}
                onSelect={(shipAddress, billAddress) => {
                  setSelectedShipAddress(shipAddress);
                  setSelectedBillAddress(billAddress);
                  if (shipAddress) handleStepClick('items');
                }}
                customerId={customer.id}
                onAddressesUpdated={loadContactsAndAddresses}
              />
            )}
          </div>
        )}

        {currentStep === 'items' && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Add Items</h2>
            <ItemSelector
              orderItems={orderItems}
              onUpdate={setOrderItems}
              customerPriceLevel={customer?.pricelevel}
            />
            {orderItems.length > 0 && (
              <div className="mt-6 pt-6 border-t flex justify-end">
                <button
                  onClick={() => handleStepClick('review')}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
                >
                  Review Order
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </div>
        )}

        {currentStep === 'review' && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <h2 className="text-xl font-semibold mb-4">Review Order</h2>

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Customer</h3>
              <p>{customer?.companyname}</p>
            </div>

            {selectedContact && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Contact</h3>
                <p>
                  {selectedContact.firstname} {selectedContact.lastname}
                </p>
                {selectedContact.email && <p className="text-sm text-gray-600">{selectedContact.email}</p>}
              </div>
            )}

            {selectedShipAddress && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Ship To</h3>
                <p className="text-sm">
                  {selectedShipAddress.addrtext || `${selectedShipAddress.addr1 || ''}, ${selectedShipAddress.city || ''}, ${selectedShipAddress.state || ''} ${selectedShipAddress.zip || ''}`.trim()}
                </p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Ship Date</h3>
              <input
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Items</h3>
              <div className="border rounded-lg divide-y">
                {orderItems.map((item, idx) => (
                  <div key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">Item {idx + 1}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${getItemPrice(item).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                <div className="p-3 bg-gray-50 flex justify-between items-center border-t-2 border-gray-300">
                  <p className="font-semibold text-lg">Total</p>
                  <p className="font-bold text-xl">${getOrderTotal().toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Order Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-6 border-t flex justify-end gap-3">
              <button
                onClick={() => handleStepClick('items')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Back
              </button>
              <button
                onClick={handleComplete}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
              >
                <Check size={18} />
                Complete Order
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
