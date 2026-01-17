'use client';

import { useState, useEffect } from 'react';
import sampleData from '@/lib/sample_date.json';
import { Package, Calendar, DollarSign, Search, Filter } from 'lucide-react';

export default function SampleDataPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const items = sampleData.items || [];
  
  // Get unique statuses and types for filters
  const uniqueStatuses = Array.from(new Set(items.map(item => item.status).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(items.map(item => item.transactiontype).filter(Boolean)));

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = !searchQuery || 
      item.documentnumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemdescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memo?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || item.status === statusFilter;
    const matchesType = !typeFilter || item.transactiontype === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate totals
  const totalItems = filteredItems.length;
  const totalAmount = filteredItems.reduce((sum, item) => {
    const amount = parseFloat(item.amount || '0');
    return sum + Math.abs(amount);
  }, 0);
  const totalQuantity = filteredItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity || '0');
    return sum + Math.abs(qty);
  }, 0);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">Sample NetSuite Data</h1>
          <p className="text-gray-600">
            Showing {filteredItems.length} of {sampleData.totalResults || sampleData.count} transactions
          </p>
        </div>

        {/* Filters and Stats */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Package size={24} className="text-blue-600" />
              <div>
                <div className="text-sm text-gray-600">Total Items</div>
                <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package size={24} className="text-green-600" />
              <div>
                <div className="text-sm text-gray-600">Total Quantity</div>
                <div className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign size={24} className="text-purple-600" />
              <div>
                <div className="text-sm text-gray-600">Total Amount</div>
                <div className="text-2xl font-bold text-gray-900">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by document, item, or memo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.trandate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.documentnumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.transactiontype}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {item.itemname}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={item.itemdescription}>
                      {item.itemdescription}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.quantity ? Math.abs(parseFloat(item.quantity)).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {item.rate ? `$${parseFloat(item.rate).toFixed(2)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      {item.amount ? `$${Math.abs(parseFloat(item.amount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <span className="inline-block max-w-xs truncate" title={item.status}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No items found matching your filters.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
