'use client';

import { useState, useEffect } from 'react';
import { Lead } from '@/lib/supabase';
import { Copy, X } from 'lucide-react';

interface LeadEditDialogProps {
  lead: Lead;
  onSave: (lead: Lead) => Promise<void>;
  onClose: () => void;
  onCopy?: () => void;
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

export default function LeadEditDialog({ lead, onSave, onClose, onCopy }: LeadEditDialogProps) {
  const [formData, setFormData] = useState({
    firstName: lead.first_name || '',
    lastName: lead.last_name || '',
    company: lead.company || '',
    email: lead.email || '',
    phone: lead.phone || '',
    source: lead.source || '',
    engagementLevel: lead.engagement_level || '',
    interestTimeline: lead.interest_timeline || '',
    productInterest: lead.product_interest || '',
    competitorInfo: lead.competitor_info || '',
    notes: lead.notes || '',
    followUpType: lead.follow_up_type || '',
  });

  const formatPhoneNumber = (value: string): string => {
    const phoneNumber = value.replace(/\D/g, '');
    const phoneNumberDigits = phoneNumber.slice(0, 10);
    
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updatedLead: Lead = {
        ...lead,
        first_name: formData.firstName,
        last_name: formData.lastName || undefined,
        company: formData.company || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        source: formData.source || undefined,
        engagement_level: formData.engagementLevel ? (formData.engagementLevel as 'Hot' | 'Warm' | 'Cold') : undefined,
        interest_timeline: formData.interestTimeline || undefined,
        product_interest: formData.productInterest || undefined,
        competitor_info: formData.competitorInfo || undefined,
        notes: formData.notes || undefined,
        follow_up_type: formData.followUpType ? (formData.followUpType as 'Personal Touch' | 'AI Sequence') : undefined,
      };
      await onSave(updatedLead);
      // onClose is called in handleLeadUpdated after save completes
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to save lead. Please try again.');
    }
  };

  const handleCopy = () => {
    // Format as TSV (tab-separated values) row for Google Sheets
    // Order matches: id, first_name, last_name, company, email, phone, source, engagement_level, interest_timeline, product_interest, competitor_info, notes, follow_up_type, created_by, synced_at, created_at
    const cleanField = (field: any): string => {
      const str = String(field || '');
      // Replace newlines and carriage returns with spaces, remove tabs
      return str.replace(/\n/g, ' ').replace(/\r/g, ' ').replace(/\t/g, ' ');
    };

    const tsvRow = [
      lead.id,
      formData.firstName,
      formData.lastName || '',
      formData.company || '',
      formData.email || '',
      formData.phone || '',
      formData.source || '',
      formData.engagementLevel || '',
      formData.interestTimeline || '',
      formData.productInterest || '',
      formData.competitorInfo || '',
      formData.notes || '',
      formData.followUpType || '',
      lead.created_by || '',
      lead.synced_at || '',
      lead.created_at,
    ].map(cleanField).join('\t');

    navigator.clipboard.writeText(tsvRow).then(() => {
      if (onCopy) onCopy();
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-xl font-semibold">Edit Lead</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 flex items-center gap-2 transition-colors"
              title="Copy as CSV row"
            >
              <Copy size={16} />
              Copy
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <X size={24} />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Company */}
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

            {/* Email and Phone */}
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

            {/* Source */}
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

            {/* Engagement Level and Follow-up Type */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Interest Timeline */}
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

            {/* Product Interest */}
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

            {/* Competitor Info */}
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

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add detailed context about this lead..."
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
