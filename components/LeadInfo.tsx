'use client';

import { useState, useEffect } from 'react';
import { Lead } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import LeadForm from './LeadForm';
import { Plus, Trash2, Mail, Phone, FileText } from 'lucide-react';

interface LeadInfoProps {
  username?: string | null;
  isOnline?: boolean;
}

export default function LeadInfo({ username, isOnline }: LeadInfoProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const allLeads = await storage.getLeads();
    // Sort by created_at descending (newest first)
    const sorted = allLeads.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setLeads(sorted);
  };

  const handleLeadCreated = async (lead: Lead) => {
    const leadWithUser = {
      ...lead,
      created_by: username || undefined,
    };
    await storage.saveLead(leadWithUser);
    // Best-effort push to Supabase when online
    if (isOnline) {
      try {
        const res = await fetch('/api/supabase/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead: {
              ...leadWithUser,
              synced_at: new Date().toISOString(),
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn('Failed to sync lead to Supabase:', err);
        } else {
          // Mark as synced locally
          await storage.saveLead({ ...leadWithUser, synced_at: new Date().toISOString() });
        }
      } catch (e) {
        console.warn('Failed to sync lead to Supabase:', e);
      }
    }
    await loadLeads();
    setShowForm(false);
  };

  const handleDeleteLead = async (leadId: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      await storage.deleteLead(leadId);
      await loadLeads();
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    return (
      lead.name.toLowerCase().includes(query) ||
      lead.company?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.source?.toLowerCase().includes(query) ||
      lead.notes?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Lead Info</h2>
            <p className="text-gray-600">Quickly add and manage leads</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            {showForm ? 'Cancel' : 'New Lead'}
          </button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Add New Lead</h3>
            <LeadForm onSave={handleLeadCreated} />
          </div>
        )}

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search leads by name, company, email, phone, source, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          Leads ({filteredLeads.length})
        </h3>
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {searchQuery ? 'No leads found matching your search.' : 'No leads yet. Click "New Lead" to add one.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map((lead) => (
              <div
                key={lead.id}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-lg">{lead.name}</h4>
                      {lead.source && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {lead.source}
                        </span>
                      )}
                    </div>
                    {lead.company && (
                      <div className="text-sm font-medium text-gray-700 mb-2">
                        {lead.company}
                      </div>
                    )}
                    <div className="space-y-1 text-sm text-gray-600">
                      {lead.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={16} />
                          <span>{lead.email}</span>
                        </div>
                      )}
                      {lead.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={16} />
                          <span>{lead.phone}</span>
                        </div>
                      )}
                      {lead.notes && (
                        <div className="flex items-start gap-2 mt-2">
                          <FileText size={16} className="mt-0.5" />
                          <span className="text-gray-700">{lead.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Created: {new Date(lead.created_at).toLocaleString()}
                      {lead.created_by && ` • By: ${lead.created_by}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLead(lead.id)}
                    className="p-2 hover:bg-red-100 rounded ml-4"
                    title="Delete lead"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

