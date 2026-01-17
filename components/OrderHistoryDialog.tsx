'use client';

import { useState, useEffect } from 'react';
import { Customer, Order, Item } from '@/lib/supabase';
import { storage } from '@/lib/storage';
import { netsuiteClient } from '@/lib/netsuite-client';
import { X, Package, Calendar, DollarSign, Eye, Filter, Search } from 'lucide-react';

interface OrderHistoryDialogProps {
  customer: Customer;
  onClose: () => void;
  onEditOrder?: (order: Order) => void;
  isOnline?: boolean;
}

export default function OrderHistoryDialog({ customer, onClose, onEditOrder, isOnline = true }: OrderHistoryDialogProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({});

  const getItem = (itemId: string) => {
    return items.find((i) => i.id === itemId);
  };


  useEffect(() => {
    loadOrders();
  }, [customer.id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Load items first
      let itemsData: Item[] = [];
      if (isOnline) {
        try {
          const response = await fetch('/api/supabase/items');
          if (response.ok) {
            const data = await response.json();
            itemsData = data.items || [];
          } else {
            itemsData = await storage.getItems();
          }
        } catch (error) {
          console.error('Error fetching items from Supabase, using local:', error);
          itemsData = await storage.getItems();
        }
      } else {
        itemsData = await storage.getItems();
      }
      setItems(itemsData);

      let ordersData: Order[] = [];
      
      // First, try to fetch orders from NetSuite if customer has netsuite_id
      if (customer.netsuite_id && isOnline) {
        try {
          console.log('Fetching orders from NetSuite for customer:', customer.netsuite_id, customer.companyname);
          const netsuiteOrders = await netsuiteClient.getCustomerOrders(customer.netsuite_id);
          console.log(`Found ${netsuiteOrders.length} orders from NetSuite for ${customer.companyname}`);
          
          // Convert NetSuite orders to our Order format
          for (const nsOrder of netsuiteOrders) {
            // Fetch items for this order
            let items: Order['items'] = [];
            try {
              console.log(`Fetching items for order ${nsOrder.id} (${nsOrder.order_number || 'no number'})`);
              const orderItems = await netsuiteClient.getOrderItems(nsOrder.id);
              console.log(`Found ${orderItems.length} items for order ${nsOrder.id}`, orderItems);
              items = orderItems.map((item: any) => {
                // Find the item in our items list by matching netsuite_id
                // NetSuite item IDs in transactionline are the internal ID, need to match against our items
                const localItem = itemsData.find((i) => i.netsuite_id === item.item_id?.toString());
                // Use local item ID if found, otherwise use NetSuite ID as fallback
                const itemId = localItem?.id || `item-${item.item_id}`;
                // Convert price to number if it exists (NetSuite might return as string)
                const price = item.price != null ? parseFloat(item.price) : undefined;
                return {
                  item_id: itemId,
                  quantity: item.quantity || 0,
                  price: price && !isNaN(price) ? price : undefined,
                  notes: item.item_notes || undefined,
                  color: item.item_color || undefined,
                  size: item.item_size || undefined,
                };
              });
              console.log(`Mapped ${items.length} items for order ${nsOrder.id}`);
            } catch (itemError) {
              console.error('Error fetching order items for order', nsOrder.id, itemError);
            }

            // Map NetSuite order status to our order status for internal use
            let status: Order['status'] = 'synced';
            if (nsOrder.order_status === 'Pending Fulfillment' || nsOrder.order_status === 'Partially Fulfilled') {
              status = 'synced';
            } else if (nsOrder.order_status === 'Pending Approval') {
              status = 'draft';
            } else {
              status = 'pushed';
            }

            const order: Order = {
              id: `netsuite-${nsOrder.id}`,
              customer_id: customer.id, // Use local customer ID
              items,
              ship_date: nsOrder.ship_date || undefined,
              notes: nsOrder.memo || undefined,
              status,
              netsuite_id: nsOrder.id.toString(),
              netsuite_status: nsOrder.order_status || undefined, // Store actual NetSuite status string
              netsuite_document_number: nsOrder.order_number || undefined, // Store actual NetSuite document number (tranid)
              // ship_address_id and bill_address_id not available from SuiteQL query
              created_at: nsOrder.created_at || nsOrder.order_date || new Date().toISOString(),
              synced_at: nsOrder.last_modified || nsOrder.created_at || new Date().toISOString(),
            };
            ordersData.push(order);
          }
          console.log(`Fetched ${netsuiteOrders.length} orders from NetSuite`);
        } catch (netsuiteError) {
          console.error('Error fetching orders from NetSuite:', netsuiteError);
          // Continue to fetch from Supabase/local as fallback
        }
      } else {
        console.log(`Customer ${customer.companyname} does not have netsuite_id, skipping NetSuite fetch`);
      }
      
      // Also fetch orders from Supabase if online (to get all orders from all users)
      // Otherwise fall back to local IndexedDB
      let appOrders: Order[] = [];
      if (isOnline) {
        try {
          const response = await fetch('/api/supabase/orders');
          if (response.ok) {
            const data = await response.json();
            appOrders = data.orders || [];
            console.log(`Fetched ${appOrders.length} orders from Supabase`);
          } else {
            console.warn('Supabase orders endpoint failed, falling back to local:', response.status);
            appOrders = await storage.getOrders();
          }
        } catch (error) {
          console.error('Error fetching orders from Supabase, using local:', error);
          appOrders = await storage.getOrders();
        }
      } else {
        appOrders = await storage.getOrders();
      }

      // Filter app orders for this customer
      const customerAppOrders = appOrders.filter(order => order.customer_id === customer.id);
      console.log(`Found ${customerAppOrders.length} app orders for customer ${customer.companyname} (ID: ${customer.id})`);
      
      // Merge NetSuite and app orders, avoiding duplicates
      // If an order exists in both (same netsuite_id), prefer the app order as it has more details
      const ordersMap = new Map<string, Order>();
      
      // Add NetSuite orders first
      ordersData.forEach(order => {
        if (order.netsuite_id) {
          ordersMap.set(order.netsuite_id, order);
        } else {
          ordersMap.set(order.id, order);
        }
      });
      
      // Overwrite with app orders (they have more details like contact_id, address_id, etc.)
      customerAppOrders.forEach(order => {
        if (order.netsuite_id) {
          ordersMap.set(order.netsuite_id, order);
        } else {
          ordersMap.set(order.id, order);
        }
      });
      
      const allOrders = Array.from(ordersMap.values());
      
      // Sort by created_at descending (newest first)
      allOrders.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

      setOrders(allOrders);
    } catch (error) {
      console.error('Error loading orders:', error);
      alert('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    // Check if it's a NetSuite status string
    if (status?.includes(':')) {
      // NetSuite status like "Sales Order : Pending Fulfillment"
      if (status.includes('Pending')) {
        return 'bg-blue-100 text-blue-800';
      } else if (status.includes('Fulfilled') || status.includes('Complete')) {
        return 'bg-green-100 text-green-800';
      } else if (status.includes('Approval')) {
        return 'bg-yellow-100 text-yellow-800';
      }
      return 'bg-gray-100 text-gray-800';
    }
    
    // App status values
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'submitted':
        return 'bg-purple-100 text-purple-800';
      case 'synced':
        return 'bg-blue-100 text-blue-800';
      case 'pushed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
          <div className="text-center py-8">Loading order history...</div>
        </div>
      </div>
    );
  }

  if (selectedOrder) {
    // Filter out items with no rate and no amount for display and totals
    const validItems = selectedOrder.items.filter(item => {
      const price = typeof item.price === 'number' ? item.price : (item.price ? parseFloat(item.price) : 0);
      const amount = price * (item.quantity || 0);
      // Include item if it has a rate OR an amount
      return price > 0 || amount > 0;
    });
    
    // Ensure all prices are numbers when calculating totals (using valid items only)
    const orderTotal = validItems.reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : (item.price ? parseFloat(item.price) : 0);
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity || 0);
      return sum + (quantity * price);
    }, 0);
    // Total items count (number of line items), not sum of quantities
    const totalItemCount = validItems.length;
    // Sum of absolute quantities for display
    const totalQuantity = validItems.reduce((sum, item) => {
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity || 0);
      return sum + Math.abs(quantity);
    }, 0);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
            <h3 className="text-xl font-semibold">Order Details</h3>
            <button
              onClick={() => setSelectedOrder(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Order ID</h4>
              <p className="text-sm text-gray-600">{selectedOrder.id}</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Status</h4>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                {selectedOrder.status.toUpperCase()}
              </span>
            </div>

            {selectedOrder.created_by && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Created By</h4>
                <p className="text-sm text-gray-600">{selectedOrder.created_by}</p>
              </div>
            )}

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Created</h4>
              <p className="text-sm text-gray-600">{formatDate(selectedOrder.created_at)}</p>
            </div>

            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Items</h4>
              <div className="border rounded-lg divide-y">
                {selectedOrder.items
                  .filter(orderItem => {
                    // Filter out items with no rate and no amount
                    const price = typeof orderItem.price === 'number' ? orderItem.price : (orderItem.price ? parseFloat(orderItem.price) : 0);
                    const amount = price * (orderItem.quantity || 0);
                    // Include item if it has a rate OR an amount
                    return price > 0 || amount > 0;
                  })
                  .map((orderItem, idx) => {
                    const item = getItem(orderItem.item_id);
                    // Ensure price and quantity are numbers
                    const price = typeof orderItem.price === 'number' ? orderItem.price : (orderItem.price ? parseFloat(orderItem.price) : 0);
                    const quantity = typeof orderItem.quantity === 'number' ? orderItem.quantity : parseFloat(String(orderItem.quantity || 0));
                    const lineTotal = quantity * price;
                    return (
                      <div key={idx} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{item?.displayname || `Item ${idx + 1}`}</p>
                          {item?.itemid && <p className="text-sm text-gray-600">ID: {item.itemid}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {orderItem.color && (
                              <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                Color: {orderItem.color}
                              </span>
                            )}
                            {orderItem.size && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                Size: {orderItem.size}
                              </span>
                            )}
                          </div>
                          {price > 0 && (
                            <p className="text-sm text-gray-500 mt-1">${price.toFixed(2)} each</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Qty: {Math.abs(quantity)}</p>
                          {lineTotal !== 0 && (
                            <p className="font-semibold text-lg text-gray-900">
                              ${Math.abs(lineTotal).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div className="p-3 bg-gray-50 flex justify-between items-center border-t-2 border-gray-300">
                  <div>
                    <p className="font-semibold text-lg text-gray-900">Total</p>
                    <p className="text-sm text-gray-600">{totalItemCount} item{totalItemCount !== 1 ? 's' : ''} • {totalQuantity.toLocaleString()} total qty</p>
                  </div>
                  <p className="font-bold text-xl text-gray-900">
                    ${Math.abs(orderTotal).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {selectedOrder.ship_date && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Ship Date</h4>
                <p className="text-sm text-gray-600">
                  {new Date(selectedOrder.ship_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            )}

            {selectedOrder.notes && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Notes</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedOrder.notes}</p>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
            <button
              onClick={() => setSelectedOrder(null)}
              className="flex-1 px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
            >
              Back to History
            </button>
            {onEditOrder && (
              <button
                onClick={() => {
                  onEditOrder(selectedOrder);
                  onClose();
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Edit Order
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Prepare orders for display (one row per order)
  // Filter out items with no rate and no amount
  const ordersWithTotals = orders.map(order => {
    // Filter items that have no rate AND no amount
    const validItems = order.items.filter(item => {
      const price = typeof item.price === 'number' ? item.price : (item.price ? parseFloat(item.price) : 0);
      const amount = price * (item.quantity || 0);
      // Include item if it has a rate OR an amount
      return price > 0 || amount > 0;
    });
    
    // If no valid items, skip this order
    if (validItems.length === 0) {
      return null;
    }
    
    const orderDate = new Date(order.created_at);
    const orderTotal = validItems.reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : (item.price ? parseFloat(item.price) : 0);
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || 0));
      return sum + (quantity * price);
    }, 0);
    const totalQuantity = validItems.reduce((sum, item) => {
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(String(item.quantity || 0));
      return sum + Math.abs(quantity);
    }, 0);
    const totalItems = validItems.length;
    
    // Get first item for display purposes (from valid items)
    const firstItem = validItems[0];
    const firstItemObj = firstItem ? getItem(firstItem.item_id) : null;
    
    // Create a new order object with only valid items for the detail view
    const orderWithValidItems = {
      ...order,
      items: validItems,
    };
    
    return {
      order: orderWithValidItems,
      orderDate: orderDate,
      documentNumber: order.netsuite_document_number || (order.netsuite_id ? `SO${order.netsuite_id}` : order.id),
      transactionType: order.netsuite_id ? 'SalesOrd' : (order.status === 'submitted' ? 'SalesOrd' : order.status),
      totalQuantity: totalQuantity,
      totalAmount: orderTotal,
      totalItems: totalItems,
      status: order.status,
      netsuiteStatus: order.netsuite_status || order.status, // Use NetSuite status if available, otherwise use app status
      memo: order.notes || '',
      createdBy: order.created_by || '',
      firstItemName: firstItemObj?.itemid || (firstItem?.item_id || ''),
      firstItemDescription: firstItemObj?.displayname || 'Multiple items',
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  // Get unique statuses and types for filters
  const uniqueStatuses = Array.from(new Set(ordersWithTotals.map(item => item.status).filter(Boolean)));
  const uniqueTypes = Array.from(new Set(ordersWithTotals.map(item => item.transactionType).filter(Boolean)));

  // Filter orders
  const filteredOrders = ordersWithTotals.filter(item => {
    const matchesSearch = !searchQuery || 
      item.documentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.firstItemName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.firstItemDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.memo?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = !statusFilter || item.netsuiteStatus === statusFilter;
    const matchesType = !typeFilter || item.transactionType === typeFilter;
    
    const orderDate = item.orderDate;
    const matchesDateStart = !dateFilter.start || orderDate >= new Date(dateFilter.start);
    const matchesDateEnd = !dateFilter.end || orderDate <= new Date(dateFilter.end + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesType && matchesDateStart && matchesDateEnd;
  });

  // Calculate totals
  const totalOrders = filteredOrders.length;
  const totalQuantity = filteredOrders.reduce((sum, item) => sum + Math.abs(item.totalQuantity), 0);
  const totalAmount = filteredOrders.reduce((sum, item) => sum + Math.abs(item.totalAmount), 0);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold">Order History</h3>
              <p className="text-sm text-gray-600 mt-1">{customer.companyname}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close dialog"
            >
              <X size={24} />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Package size={20} className="text-blue-600" />
              <div>
                <div className="text-xs text-gray-600">Total Orders</div>
                <div className="text-lg font-bold text-gray-900">{totalOrders}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Package size={20} className="text-green-600" />
              <div>
                <div className="text-xs text-gray-600">Total Quantity</div>
                <div className="text-lg font-bold text-gray-900">{totalQuantity.toLocaleString()}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <DollarSign size={20} className="text-purple-600" />
              <div>
                <div className="text-xs text-gray-600">Total Amount</div>
                <div className="text-lg font-bold text-gray-900">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={16} className="text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-700">Filters</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <input
                  type="date"
                  placeholder="Start Date"
                  value={dateFilter.start || ''}
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <input
                  type="date"
                  placeholder="End Date"
                  value={dateFilter.end || ''}
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            {(dateFilter.start || dateFilter.end || statusFilter || typeFilter || searchQuery) && (
              <button
                onClick={() => {
                  setDateFilter({});
                  setStatusFilter('');
                  setTypeFilter('');
                  setSearchQuery('');
                }}
                className="mt-3 px-4 py-1 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-4 text-gray-400" />
              <p>No orders found matching your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Document</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">First Item</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((orderData) => (
                    <tr 
                      key={orderData.order.id} 
                      onClick={() => setSelectedOrder(orderData.order)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {orderData.orderDate.toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {orderData.documentNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {orderData.transactionType}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {orderData.totalItems} item{orderData.totalItems !== 1 ? 's' : ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={orderData.firstItemDescription}>
                        {orderData.totalItems > 1 ? (
                          <span>{orderData.firstItemDescription} <span className="text-gray-400">+{orderData.totalItems - 1} more</span></span>
                        ) : (
                          orderData.firstItemDescription
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {orderData.totalQuantity ? orderData.totalQuantity.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                        {orderData.totalAmount ? `$${Math.abs(orderData.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(orderData.netsuiteStatus)}`}>
                          {orderData.netsuiteStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedOrder(orderData.order)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View order details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
