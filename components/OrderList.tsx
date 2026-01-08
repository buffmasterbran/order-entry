'use client';

import { useState, useEffect } from 'react';
import { storage } from '@/lib/storage';
import { Order, Customer, Contact, Address, Item } from '@/lib/supabase';
import { X, Calendar, User, Package, Trash2, Edit2, Eye, EyeOff, Upload, Filter, DollarSign, Check } from 'lucide-react';

interface OrderListProps {
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
  onEditOrder?: (order: Order) => void;
  isOnline?: boolean;
}

export default function OrderList({ onClose, onSelectOrder, onEditOrder, isOnline = true }: OrderListProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showFullCardNumber, setShowFullCardNumber] = useState(false);
  const [pushingOrder, setPushingOrder] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({});
  const [userFilter, setUserFilter] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch orders from Supabase if online (to get all orders from all users)
      // Otherwise fall back to local IndexedDB
      let ordersData: Order[] = [];
      if (isOnline) {
        try {
          const response = await fetch('/api/supabase/orders');
          if (response.ok) {
            const data = await response.json();
            ordersData = data.orders || [];
          } else {
            // Fall back to local if Supabase fetch fails
            ordersData = await storage.getOrders();
          }
        } catch (error) {
          console.error('Error fetching orders from Supabase, using local:', error);
          ordersData = await storage.getOrders();
        }
      } else {
        ordersData = await storage.getOrders();
      }

      // Fetch customers and items - use Supabase if online, otherwise local
      let customersData: Customer[] = [];
      let itemsData: Item[] = [];
      
      if (isOnline) {
        try {
          const [customersResponse, itemsResponse] = await Promise.all([
            fetch('/api/supabase/customers'),
            fetch('/api/supabase/items'),
          ]);
          
          if (customersResponse.ok) {
            const customersResult = await customersResponse.json();
            customersData = customersResult.customers || [];
          } else {
            customersData = await storage.getCustomers();
          }
          
          if (itemsResponse.ok) {
            const itemsResult = await itemsResponse.json();
            itemsData = itemsResult.items || [];
          } else {
            itemsData = await storage.getItems();
          }
        } catch (error) {
          console.error('Error fetching from Supabase, using local:', error);
          customersData = await storage.getCustomers();
          itemsData = await storage.getItems();
        }
      } else {
        customersData = await storage.getCustomers();
        itemsData = await storage.getItems();
      }
      
      setOrders(ordersData);
      setCustomers(customersData);
      setItems(itemsData);

      // Load contacts and addresses for customers that have orders
      const customerIdsInOrders = new Set(ordersData.map(order => order.customer_id));
      
      // Check for missing customers referenced in orders
      const missingCustomerIds = Array.from(customerIdsInOrders).filter(
        id => !customersData.find(c => c.id === id)
      );
      
      if (missingCustomerIds.length > 0) {
        console.log(`Missing ${missingCustomerIds.length} customers referenced in orders:`, missingCustomerIds);
        
        // Try to fetch missing customers from Supabase by ID
        if (isOnline) {
          for (const customerId of missingCustomerIds) {
            try {
              const response = await fetch(`/api/supabase/customers/${encodeURIComponent(customerId)}`);
              if (response.ok) {
                const data = await response.json();
                if (data.customer && !customersData.find(c => c.id === data.customer.id)) {
                  customersData.push(data.customer);
                  console.log(`Found missing customer ${customerId}:`, data.customer.companyname);
                }
              }
            } catch (error) {
              console.error(`Error fetching customer ${customerId} from Supabase:`, error);
            }
          }
        }
        
        // Also try local storage as fallback
        const stillMissing = Array.from(customerIdsInOrders).filter(
          id => !customersData.find(c => c.id === id)
        );
        
        for (const customerId of stillMissing) {
          try {
            const localCustomer = await storage.getCustomer(customerId).catch(() => null);
            if (localCustomer && !customersData.find(c => c.id === localCustomer.id)) {
              customersData.push(localCustomer);
              console.log(`Found missing customer ${customerId} in local storage:`, localCustomer.companyname);
            }
          } catch (err) {
            console.error(`Error loading customer ${customerId} from local:`, err);
          }
        }
        
        // Update customers state with any newly found customers
        if (missingCustomerIds.length > 0) {
          setCustomers([...customersData]);
        }
      }
      
      // Get all address IDs referenced in orders (ship and bill addresses)
      const addressIdsInOrders = new Set<string>();
      ordersData.forEach(order => {
        if (order.ship_address_id) addressIdsInOrders.add(order.ship_address_id);
        if (order.bill_address_id) addressIdsInOrders.add(order.bill_address_id);
      });
      
      const allContacts: Contact[] = [];
      const allAddresses: Address[] = [];
      
      if (isOnline) {
        // Fetch contacts and addresses from Supabase
        try {
          const [contactsResponse, addressesResponse] = await Promise.all([
            fetch('/api/supabase/contacts'),
            fetch('/api/supabase/addresses'),
          ]);
          
          if (contactsResponse.ok) {
            const contactsResult = await contactsResponse.json();
            const allSupabaseContacts = contactsResult.contacts || [];
            // Filter to only contacts for customers in orders
            allContacts.push(...allSupabaseContacts.filter((c: Contact) => 
              customerIdsInOrders.has(c.customer_id)
            ));
          }
          
          if (addressesResponse.ok) {
            const addressesResult = await addressesResponse.json();
            const allSupabaseAddresses = addressesResult.addresses || [];
            // Include ALL addresses - we'll use the ones we need when displaying orders
            // This ensures we don't miss any addresses referenced by orders
            allAddresses.push(...allSupabaseAddresses);
          }
        } catch (error) {
          console.error('Error fetching contacts/addresses from Supabase:', error);
        }
      }
      
      // Also try to load from local storage as fallback or supplement
      for (const customerId of customerIdsInOrders) {
        try {
          const [customerContacts, customerAddresses] = await Promise.all([
            storage.getCustomerContacts(customerId).catch(() => []),
            storage.getCustomerAddresses(customerId).catch(() => []),
          ]);
          
          // Only add if not already in the array (avoid duplicates)
          customerContacts.forEach(contact => {
            if (!allContacts.find(c => c.id === contact.id)) {
              allContacts.push(contact);
            }
          });
          
          customerAddresses.forEach(address => {
            if (!allAddresses.find(a => a.id === address.id)) {
              allAddresses.push(address);
            }
          });
        } catch (err) {
          console.error(`Error loading local data for customer ${customerId}:`, err);
          // Continue with other customers even if one fails
        }
      }
      
      // Also fetch addresses directly by ID if they're referenced in orders but not found yet
      const missingAddressIds = Array.from(addressIdsInOrders).filter(
        id => !allAddresses.find(a => a.id === id)
      );
      
      if (missingAddressIds.length > 0) {
        console.log(`Missing ${missingAddressIds.length} addresses referenced in orders:`, missingAddressIds);
        
        // If online, fetch ALL addresses from Supabase (not filtered) to find missing ones
        if (isOnline) {
          try {
            const addressesResponse = await fetch('/api/supabase/addresses');
            if (addressesResponse.ok) {
              const addressesResult = await addressesResponse.json();
              const allSupabaseAddresses = addressesResult.addresses || [];
              missingAddressIds.forEach(missingId => {
                const found = allSupabaseAddresses.find((a: Address) => a.id === missingId);
                if (found && !allAddresses.find(a => a.id === found.id)) {
                  allAddresses.push(found);
                  console.log(`Found missing address ${missingId} in Supabase:`, found.addrtext || found.addr1);
                } else if (!found) {
                  console.warn(`Address ${missingId} not found in Supabase - may be orphaned or not synced`);
                }
              });
            }
          } catch (error) {
            console.error('Error fetching missing addresses from Supabase:', error);
          }
        }
      }
      
      setContacts(allContacts);
      setAddresses(allAddresses);
    } catch (error) {
      console.error('Error loading orders:', error);
      alert('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getCustomer = (customerId: string) => {
    return customers.find((c) => c.id === customerId);
  };

  const getContact = (contactId?: string) => {
    if (!contactId) return null;
    return contacts.find((c) => c.id === contactId);
  };

  const getAddress = (addressId?: string) => {
    if (!addressId) return null;
    return addresses.find((a) => a.id === addressId);
  };

  const getItem = (itemId: string) => {
    return items.find((i) => i.id === itemId);
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
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'synced':
        return 'bg-blue-100 text-blue-800';
      case 'pushed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get unique list of users who created orders
  const getUniqueUsers = () => {
    const users = new Set<string>();
    orders.forEach(order => {
      if (order.created_by) {
        users.add(order.created_by);
      }
    });
    return Array.from(users).sort();
  };

  // Filter orders based on date and user filters
  const getFilteredOrders = () => {
    return orders.filter(order => {
      // Date filter
      if (dateFilter.start || dateFilter.end) {
        const orderDate = new Date(order.created_at);
        if (dateFilter.start) {
          const startDate = new Date(dateFilter.start);
          startDate.setHours(0, 0, 0, 0);
          if (orderDate < startDate) return false;
        }
        if (dateFilter.end) {
          const endDate = new Date(dateFilter.end);
          endDate.setHours(23, 59, 59, 999);
          if (orderDate > endDate) return false;
        }
      }

      // User filter
      if (userFilter && order.created_by !== userFilter) {
        return false;
      }

      return true;
    });
  };

  // Calculate totals for filtered orders
  const calculateTotals = () => {
    const filtered = getFilteredOrders();
    const orderTotal = filtered.length;
    const dollarTotal = filtered.reduce((sum, order) => {
      const orderTotal = order.items.reduce((itemSum, item) => {
        return itemSum + (item.quantity * (item.price || 0));
      }, 0);
      return sum + orderTotal;
    }, 0);
    return { orderTotal, dollarTotal };
  };

  const handleDeleteOrder = async (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicking the order card
    if (!confirm('Are you sure you want to delete this order?')) {
      return;
    }

    try {
      await storage.deleteOrder(orderId);
      // Reload orders after deletion
      await loadData();
      // If we deleted the selected order, go back to list
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Failed to delete order');
    }
  };

  const handleEditOrder = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicking the order card
    if (onEditOrder) {
      onEditOrder(order);
      onClose();
    }
  };

  const handleSubmitOrder = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicking the order card
    if (!confirm('Are you sure you want to submit this draft order?')) {
      return;
    }

    try {
      const submittedOrder: Order = {
        ...order,
        status: 'submitted',
        synced_at: new Date().toISOString(),
      };
      await storage.saveOrder(submittedOrder);
      await loadData(); // Reload orders
      // Update selected order if it's the one we just submitted
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(submittedOrder);
      }
      alert('Order submitted successfully!');
    } catch (error) {
      console.error('Error submitting order:', error);
      alert('Failed to submit order');
    }
  };

  const handlePushOrderToNetSuite = async () => {
    if (!selectedOrder) return;

    const customer = getCustomer(selectedOrder.customer_id);
    const shipAddress = getAddress(selectedOrder.ship_address_id);
    const billAddress = getAddress(selectedOrder.bill_address_id);

    // Check requirements
    if (!customer?.netsuite_id) {
      alert('Cannot push order: Customer does not exist in NetSuite. Please sync the customer first.');
      return;
    }

    if (!shipAddress?.netsuite_id) {
      alert('Cannot push order: Ship address does not exist in NetSuite. Orders require a NetSuite address.');
      return;
    }

    // Map order items - check all items have netsuite_id
    const itemsToPush: Array<{ itemId: string; quantity: number; price?: number }> = [];
    for (const orderItem of selectedOrder.items) {
      const item = getItem(orderItem.item_id);
      if (!item?.netsuite_id) {
        alert(`Cannot push order: Item "${item?.displayname || orderItem.item_id}" does not exist in NetSuite. Please sync items first.`);
        return;
      }
      itemsToPush.push({
        itemId: item.netsuite_id,
        quantity: orderItem.quantity,
        price: orderItem.price,
      });
    }

    setPushingOrder(true);
    try {
      const response = await fetch('/api/netsuite/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.netsuite_id,
          shipAddressId: shipAddress.netsuite_id,
          billAddressId: billAddress?.netsuite_id,
          items: itemsToPush,
          shipDate: selectedOrder.ship_date,
          memo: selectedOrder.notes,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to push order to NetSuite: ${error.error || 'Unknown error'}`);
        return;
      }

      const result = await response.json();
      
      // Update order with NetSuite ID and status
      const updatedOrder: Order = {
        ...selectedOrder,
        status: 'pushed' as const,
        netsuite_id: result.netsuiteId,
        synced_at: new Date().toISOString(),
      };

      await storage.saveOrder(updatedOrder);
      await loadData(); // Reload orders
      setSelectedOrder(updatedOrder);
      
      alert('Order successfully pushed to NetSuite!');
    } catch (error) {
      console.error('Error pushing order to NetSuite:', error);
      alert('Failed to push order to NetSuite. Please try again.');
    } finally {
      setPushingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">Loading orders...</div>
      </div>
    );
  }

  if (selectedOrder) {
    const customer = getCustomer(selectedOrder.customer_id);
    const contact = getContact(selectedOrder.contact_id);
    const shipAddress = getAddress(selectedOrder.ship_address_id);
    const billAddress = getAddress(selectedOrder.bill_address_id);

    // Debug: Log credit card data to console
    console.log('Order credit card data:', selectedOrder.credit_card);

    // Format card number for display
    const formatCardNumberForDisplay = (number: string): string => {
      if (!number) return '';
      if (showFullCardNumber) {
        // Show full number with spaces for readability
        const digits = number.replace(/\D/g, '');
        if (digits.length === 15) {
          // Amex format: 4-6-5
          return `${digits.slice(0, 4)} ${digits.slice(4, 10)} ${digits.slice(10, 15)}`;
        } else {
          // Visa/Mastercard format: 4-4-4-4
          return digits.match(/.{1,4}/g)?.join(' ') || digits;
        }
      } else {
        // Show only last 4 digits
        const digits = number.replace(/\D/g, '');
        return `**** ${digits.slice(-4)}`;
      }
    };

    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Order Details</h2>
          <button
            onClick={() => {
              setSelectedOrder(null);
              setShowFullCardNumber(false); // Reset reveal state when closing
            }}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Order ID</h3>
            <p className="text-sm text-gray-600">{selectedOrder.id}</p>
          </div>

          {customer && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Customer</h3>
              <p>{customer.companyname}</p>
              {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
            </div>
          )}

          {selectedOrder.created_by && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Created By</h3>
              <p>{selectedOrder.created_by}</p>
            </div>
          )}

          {contact && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Buyer</h3>
              <p>
                {contact.firstname} {contact.lastname}
              </p>
              {contact.email && <p className="text-sm text-gray-600">{contact.email}</p>}
            </div>
          )}

          {shipAddress && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Ship To</h3>
              <p className="text-sm">
                {shipAddress.addrtext ||
                  `${shipAddress.addr1 || ''}, ${shipAddress.city || ''}, ${shipAddress.state || ''} ${shipAddress.zip || ''}`.trim()}
              </p>
            </div>
          )}

          {billAddress && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Bill To</h3>
              <p className="text-sm">
                {billAddress.addrtext ||
                  `${billAddress.addr1 || ''}, ${billAddress.city || ''}, ${billAddress.state || ''} ${billAddress.zip || ''}`.trim()}
              </p>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Items</h3>
            <div className="border rounded-lg divide-y">
              {selectedOrder.items.map((orderItem, idx) => {
                const item = getItem(orderItem.item_id);
                const lineTotal = orderItem.quantity * (orderItem.price || 0);
                return (
                  <div key={idx} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{item?.displayname || `Item ${idx + 1}`}</p>
                      {item?.itemid && <p className="text-sm text-gray-600">ID: {item.itemid}</p>}
                      {orderItem.price && (
                        <p className="text-sm text-gray-500">${orderItem.price.toFixed(2)} each</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Qty: {orderItem.quantity}</p>
                      <p className="font-semibold text-lg text-gray-900">
                        ${lineTotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="p-3 bg-gray-50 flex justify-between items-center border-t-2 border-gray-300">
                <p className="font-semibold text-lg text-gray-900">Order Total</p>
                <p className="font-bold text-xl text-gray-900">
                  ${selectedOrder.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {selectedOrder.ship_date && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Ship Date</h3>
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
              <h3 className="font-semibold text-gray-700 mb-2">Order Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedOrder.notes}</p>
            </div>
          )}

          {selectedOrder.credit_card && 
           (selectedOrder.credit_card.name || selectedOrder.credit_card.number || selectedOrder.credit_card.expiry) && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Credit Card Information</h3>
              <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
                {selectedOrder.credit_card.name && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Name on Card: </span>
                    <span className="text-sm text-gray-600">{selectedOrder.credit_card.name}</span>
                  </div>
                )}
                {selectedOrder.credit_card.number && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-700">Card Number: </span>
                      <span className="text-sm text-gray-600 font-mono">
                        {formatCardNumberForDisplay(selectedOrder.credit_card.number)}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowFullCardNumber(!showFullCardNumber)}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800"
                      title={showFullCardNumber ? 'Hide full number' : 'Show full number'}
                    >
                      {showFullCardNumber ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}
                {selectedOrder.credit_card.expiry && (
                  <div>
                    <span className="text-sm font-medium text-gray-700">Expiry: </span>
                    <span className="text-sm text-gray-600">{selectedOrder.credit_card.expiry}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Status</h3>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
              {selectedOrder.status.toUpperCase()}
            </span>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Created</h3>
            <p className="text-sm text-gray-600">{formatDate(selectedOrder.created_at)}</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex gap-3">
          <button
            onClick={() => {
              setSelectedOrder(null);
              setShowFullCardNumber(false); // Reset reveal state when going back
            }}
            className="flex-1 px-6 py-3 bg-gray-200 rounded-lg hover:bg-gray-300 font-medium"
          >
            Back to Orders
          </button>
          {selectedOrder.status === 'draft' && (
            <button
              onClick={(e) => handleSubmitOrder(selectedOrder, e)}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium flex items-center gap-2"
            >
              <Check size={18} />
              Submit Order
            </button>
          )}
          {customer?.netsuite_id && shipAddress?.netsuite_id && selectedOrder.status !== 'pushed' && (
            <button
              onClick={handlePushOrderToNetSuite}
              disabled={pushingOrder}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Upload size={18} />
              {pushingOrder ? 'Pushing...' : 'Push to NetSuite'}
            </button>
          )}
          {onEditOrder && (
            <button
              onClick={(e) => handleEditOrder(selectedOrder, e)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
            >
              <Edit2 size={18} />
              Edit Order
            </button>
          )}
          <button
            onClick={async (e) => await handleDeleteOrder(selectedOrder.id, e)}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
          >
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();
  const { orderTotal, dollarTotal } = calculateTotals();
  const uniqueUsers = getUniqueUsers();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Submitted Orders</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <X size={20} />
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          <Package size={24} className="text-blue-600" />
          <div>
            <div className="text-sm text-gray-600">Order Total</div>
            <div className="text-2xl font-bold text-gray-900">{orderTotal}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DollarSign size={24} className="text-green-600" />
          <div>
            <div className="text-sm text-gray-600">Dollar Total</div>
            <div className="text-2xl font-bold text-gray-900">${dollarTotal.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-gray-600" />
          <h3 className="font-semibold text-gray-700">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateFilter.start || ''}
              onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateFilter.end || ''}
              onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Created By
            </label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Users</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>
        {(dateFilter.start || dateFilter.end || userFilter) && (
          <button
            onClick={() => {
              setDateFilter({});
              setUserFilter('');
            }}
            className="mt-3 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package size={48} className="mx-auto mb-4 text-gray-400" />
          <p>{orders.length === 0 ? 'No orders found' : 'No orders match the current filters'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const customer = getCustomer(order.customer_id);
            const contact = getContact(order.contact_id);
            const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
            const orderTotal = order.items.reduce((sum, item) => sum + (item.quantity * (item.price || 0)), 0);

            return (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-lg">
                        {customer?.companyname || 'Unknown Customer'}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status.toUpperCase()}
                      </span>
                    </div>
                    {contact && (
                      <p className="text-sm text-gray-600 mb-1">
                        {contact.firstname} {contact.lastname}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Package size={14} />
                        <span>{totalItems} items</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{formatDate(order.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1 font-semibold text-gray-900">
                        <DollarSign size={14} />
                        <span>${orderTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                    {order.status === 'draft' && (
                      <button
                        onClick={(e) => handleSubmitOrder(order, e)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Submit order"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    {onEditOrder && (
                      <button
                        onClick={(e) => handleEditOrder(order, e)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit order"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteOrder(order.id, e)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete order"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

