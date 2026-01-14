'use client';

import { useState } from 'react';
import { Lead } from '@/lib/supabase';

interface LeadFormProps {
  onSave: (lead: Lead) => void;
  onCancel?: () => void;
}

const LEAD_SOURCES = [
  'PPAI',
  'Surf Expo',
  'PGA',
  'Atlanta Gift',
  'Vegas Gift',
] as const;

const ENGAGEMENT_LEVELS = ['Hot', 'Warm', 'Cold'] as const;
const FOLLOW_UP_TYPES = ['Personal Touch', 'AI Sequence'] as const;

export default function LeadForm({ onSave, onCancel }: LeadFormProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    company: '',
    email: '',
    phone: '',
    source: '',
    engagementLevel: '',
    interestTimeline: '',
    productInterest: '',
    competitorInfo: '',
    notes: '',
    followUpType: '',
    sendToRep: '',
    billingZipcode: '',
  });

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Limit to 10 digits (US phone number)
    const phoneNumberDigits = phoneNumber.slice(0, 10);
    
    // Format as (XXX) XXX-XXXX
    if (phoneNumberDigits.length === 0) {
      return '';
    } else if (phoneNumberDigits.length <= 3) {
      return `(${phoneNumberDigits}`;
    } else if (phoneNumberDigits.length <= 6) {
      return `(${phoneNumberDigits.slice(0, 3)}) ${phoneNumberDigits.slice(3)}`;
    } else {
      return `(${phoneNumberDigits.slice(0, 3)}) ${phoneNumberDigits.slice(3, 6)}-${phoneNumberDigits.slice(6)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lead: Lead = {
      id: `lead-${Date.now()}`,
      first_name: formData.firstName,
      last_name: formData.lastName || undefined,
      company: formData.company || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      source: formData.source || undefined,
      engagement_level: (formData.engagementLevel as 'Hot' | 'Warm' | 'Cold') || undefined,
      interest_timeline: formData.interestTimeline || undefined,
      product_interest: formData.productInterest || undefined,
      competitor_info: formData.competitorInfo || undefined,
      notes: formData.notes || undefined,
      follow_up_type: (formData.followUpType as 'Personal Touch' | 'AI Sequence') || undefined,
      send_to_rep: (formData.sendToRep as 'Yes' | 'No') || undefined,
      billing_zipcode: formData.billingZipcode || undefined,
      created_at: new Date().toISOString(),
    };
    onSave(lead);
    // Reset form
    setFormData({ 
      firstName: '', 
      lastName: '', 
      company: '', 
      email: '', 
      phone: '', 
      source: '', 
      engagementLevel: '',
      interestTimeline: '',
      productInterest: '',
      competitorInfo: '',
      notes: '',
      followUpType: '',
      sendToRep: '',
      billingZipcode: '',
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Company on its own line (above names) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company
        </label>
        <input
          type="text"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter company name"
        />
      </div>

      {/* First and Last Name */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            required
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter first name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter last name"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={handlePhoneChange}
            placeholder="(123) 456-7890"
            maxLength={14}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Source
        </label>
        <select
          value={formData.source}
          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a source...</option>
          {LEAD_SOURCES.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Engagement Level
        </label>
        <select
          value={formData.engagementLevel}
          onChange={(e) => setFormData({ ...formData, engagementLevel: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select engagement level...</option>
          {ENGAGEMENT_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Interest Timeline
        </label>
        <input
          type="text"
          value={formData.interestTimeline}
          onChange={(e) => setFormData({ ...formData, interestTimeline: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Immediate, 1-2 months, Long-term, Q2 2024..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Product Interest
        </label>
        <input
          type="text"
          value={formData.productInterest}
          onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Specific products they showed interest in..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Competitor Info
        </label>
        <input
          type="text"
          value={formData.competitorInfo}
          onChange={(e) => setFormData({ ...formData, competitorInfo: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Current suppliers (e.g., Corkcicle)..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Follow-up Type
        </label>
        <select
          value={formData.followUpType}
          onChange={(e) => setFormData({ ...formData, followUpType: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select follow-up type...</option>
          {FOLLOW_UP_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Send to Rep
          </label>
          <select
            value={formData.sendToRep}
            onChange={(e) => setFormData({ ...formData, sendToRep: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Billing Zipcode
          </label>
          <input
            type="text"
            value={formData.billingZipcode}
            onChange={(e) => setFormData({ ...formData, billingZipcode: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter zipcode"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Add detailed context about this lead..."
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      <div className="flex gap-4 pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Add Lead
        </button>
      </div>
    </form>
  );
}

