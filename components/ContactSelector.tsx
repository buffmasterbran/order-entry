'use client';

import { useState, useEffect } from 'react';
import { User, Plus } from 'lucide-react';
import { Contact } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { netsuiteClient } from '@/lib/netsuite-client';
import ContactForm from './ContactForm';

interface ContactSelectorProps {
  contacts: Contact[];
  selectedId?: string;
  onSelect: (contact: Contact | null) => void;
  customerId: string;
  onContactsUpdated?: () => void;
}

export default function ContactSelector({ contacts, selectedId, onSelect, customerId, onContactsUpdated }: ContactSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localContacts, setLocalContacts] = useState(contacts);
  // Local state for selection (allows user to select before continuing)
  const [localSelectedId, setLocalSelectedId] = useState<string | undefined>(selectedId);

  const handleLoadFromNetSuite = async () => {
    setLoading(true);
    try {
      const customer = await storage.getCustomer(customerId);
      if (customer?.netsuite_id) {
        const nsContacts = await netsuiteClient.getCustomerContacts(customer.netsuite_id);
        const contactsToSave = nsContacts.map((c: any) => ({
          id: `contact-${c.id}`,
          customer_id: customerId,
          netsuite_id: c.id.toString(),
          entityid: c.entityid || '',
          firstname: c.firstname || '',
          lastname: c.lastname || '',
          email: c.email || '',
          phone: c.phone || '',
          title: c.title || '',
          synced_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }));
        await storage.saveContacts(contactsToSave);
        // Refresh contacts
        const updatedContacts = await storage.getCustomerContacts(customerId);
        setLocalContacts(updatedContacts);
        if (onContactsUpdated) onContactsUpdated();
      }
    } catch (error) {
      console.error('Error loading contacts from NetSuite:', error);
      alert('Failed to load contacts from NetSuite. Make sure you are online and synced.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactCreated = async (contact: Contact) => {
    await storage.saveContact(contact);
    const updatedContacts = await storage.getCustomerContacts(customerId);
    setLocalContacts(updatedContacts);
    setShowCreateForm(false);
    // Select the newly created contact and notify parent
    setLocalSelectedId(contact.id);
    onSelect(contact);
    if (onContactsUpdated) onContactsUpdated();
  };

  // Update local contacts and selection when prop changes
  useEffect(() => {
    setLocalContacts(contacts);
    setLocalSelectedId(selectedId);
  }, [contacts, selectedId]);

  if (showCreateForm) {
    return (
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Create New Contact</h3>
          <button
            onClick={() => setShowCreateForm(false)}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
        <ContactForm customerId={customerId} onSave={handleContactCreated} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Select Buyer (Contact)</h3>
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
            New Contact
          </button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <button
          onClick={() => setLocalSelectedId(undefined)}
          className={`w-full text-left p-4 border rounded-lg transition-colors ${
            !localSelectedId
              ? 'bg-blue-50 border-blue-300'
              : 'border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 rounded-full p-2">
              <User size={20} className="text-gray-600" />
            </div>
            <div>
              <div className="font-semibold">No Contact Selected</div>
              <div className="text-sm text-gray-600">Skip this step</div>
            </div>
          </div>
        </button>

        {localContacts.map((contact) => (
          <button
            key={contact.id}
            onClick={() => setLocalSelectedId(contact.id)}
            className={`w-full text-left p-4 border rounded-lg transition-colors ${
              localSelectedId === contact.id
                ? 'bg-blue-50 border-blue-300'
                : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-full p-2">
                <User size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="font-semibold">
                  {contact.firstname} {contact.lastname}
                </div>
                <div className="text-sm text-gray-600">
                  {contact.email && `${contact.email} • `}
                  {contact.title && contact.title}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={() => {
            const selectedContact = localContacts.find((c) => c.id === localSelectedId) || null;
            onSelect(selectedContact);
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

