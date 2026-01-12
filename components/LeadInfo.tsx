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
  }, [isOnline]);

  const loadLeads = async () => {
    let allLeads: Lead[] = [];
    
    // Fetch leads from Supabase if online (to get all leads from all users)
    // Otherwise fall back to local IndexedDB
    if (isOnline) {
      try {
        const response = await fetch('/api/supabase/leads');
        if (response.ok) {
          const data = await response.json();
          allLeads = data.leads || [];
          
          // Also save to local storage for offline access
          for (const lead of allLeads) {
            try {
              await storage.saveLead(lead);
            } catch (error) {
              // Continue if one fails
              console.warn('Failed to save lead to local storage:', error);
            }
          }
        } else {
          // Fall back to local if Supabase fetch fails
          allLeads = await storage.getLeads();
        }
      } catch (error) {
        console.error('Error fetching leads from Supabase, using local:', error);
        allLeads = await storage.getLeads();
      }
    } else {
      allLeads = await storage.getLeads();
    }
    
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
    if (!confirm('Are you sure you want to delete this lead?')) {
      return;
    }

    try {
      let deleteSuccess = false;

      // Delete from Supabase when online
      if (isOnline) {
        try {
          const response = await fetch(`/api/supabase/leads/${encodeURIComponent(leadId)}`, {
            method: 'DELETE',
          });

          if (response.ok) {
            deleteSuccess = true;
          } else {
            const error = await response.json().catch(() => ({}));
            console.error('Failed to delete lead from Supabase:', error);
            alert('Failed to delete lead from server. Please try again.');
            return; // Don't delete locally if server deletion failed
          }
        } catch (error) {
          console.error('Error deleting lead from Supabase:', error);
          alert('Failed to delete lead from server. Please try again.');
          return; // Don't delete locally if server deletion failed
        }
      } else {
        // If offline, we can only delete locally
        deleteSuccess = true;
      }

      // Only delete from local storage if Supabase deletion succeeded (or we're offline)
      if (deleteSuccess) {
        await storage.deleteLead(leadId);
      }

      // Reload leads to refresh the UI
      await loadLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      alert('Failed to delete lead. Please try again.');
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const query = searchQuery.toLowerCase();
    const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').toLowerCase();
    return (
      lead.first_name.toLowerCase().includes(query) ||
      lead.last_name?.toLowerCase().includes(query) ||
      fullName.includes(query) ||
      lead.company?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.phone?.includes(query) ||
      lead.source?.toLowerCase().includes(query) ||
      lead.engagement_level?.toLowerCase().includes(query) ||
      lead.interest_timeline?.toLowerCase().includes(query) ||
      lead.product_interest?.toLowerCase().includes(query) ||
      lead.competitor_info?.toLowerCase().includes(query) ||
      lead.follow_up_type?.toLowerCase().includes(query) ||
      lead.notes?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      {/* Dialog Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Add New Lead</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close dialog"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <LeadForm 
                onSave={handleLeadCreated} 
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Lead Info</h2>
            <p className="text-gray-600">Quickly add and manage leads</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus size={20} />
            New Lead
          </button>
        </div>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Search leads by name, company, email, phone, source, engagement level, timeline, product interest, competitor info, follow-up type, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">
          All Leads ({filteredLeads.length} {leads.length !== filteredLeads.length ? `of ${leads.length}` : ''})
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
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-semibold text-lg">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
                      </h4>
                      {lead.source && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {lead.source}
                        </span>
                      )}
                      {lead.engagement_level && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          lead.engagement_level === 'Hot' ? 'bg-red-100 text-red-800' :
                          lead.engagement_level === 'Warm' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.engagement_level}
                        </span>
                      )}
                      {lead.follow_up_type && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded">
                          {lead.follow_up_type}
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
                      {lead.interest_timeline && (
                        <div className="text-gray-700">
                          <span className="font-medium">Timeline: </span>{lead.interest_timeline}
                        </div>
                      )}
                      {lead.product_interest && (
                        <div className="text-gray-700">
                          <span className="font-medium">Product Interest: </span>{lead.product_interest}
                        </div>
                      )}
                      {lead.competitor_info && (
                        <div className="text-gray-700">
                          <span className="font-medium">Competitor Info: </span>{lead.competitor_info}
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

