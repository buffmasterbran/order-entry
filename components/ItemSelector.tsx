'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, Barcode, ArrowUpDown } from 'lucide-react';
import { storage } from '@/lib/storage';
import { Item, OrderItem } from '@/lib/supabase';
import { getPriceForQuantity, getPriceBreaksForLevel } from '@/lib/price-calculator';

interface ItemSelectorProps {
  orderItems: OrderItem[];
  onUpdate: (items: OrderItem[]) => void;
  customerPriceLevel?: string; // Customer's price level (e.g., "1", "3", "4", "14")
}

export default function ItemSelector({ orderItems, onUpdate, customerPriceLevel }: ItemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeMode, setBarcodeMode] = useState(true); // Default to barcode mode
  const [sortBy, setSortBy] = useState<'none' | 'color' | 'sku'>('none');
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  useEffect(() => {
    if (barcodeMode && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    } else if (!barcodeMode && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [barcodeMode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, []);

  const loadItems = async () => {
    const items = await storage.getItems();
    setAllItems(items);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const results = await storage.searchItems(query);
    setSearchResults(results);
    setShowSearchResults(true);
  };

  const handleBarcodeScan = async (barcode: string) => {
    if (!barcode.trim()) return;

    // Try to find item by itemid (assuming barcode matches itemid)
    const item = await storage.getItemByItemId(barcode.trim());
    
    if (item) {
      // Check if item is already in order
      const existingIndex = orderItems.findIndex((oi) => oi.item_id === item.id);
      if (existingIndex >= 0) {
        // Item already exists - show dialog
        const existingItem = orderItems[existingIndex];
        const currentQuantity = existingItem.quantity;
        const confirmed = window.confirm(
          `This item "${item.displayname}" (${item.itemid}) is already in your order with a quantity of ${currentQuantity}.\n\n` +
          `Would you like to add 3 more pieces? (New total: ${currentQuantity + 3})`
        );
        
        if (confirmed) {
        // Increment quantity by 3
        const updated = [...orderItems];
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + 3,
        };
        onUpdate(updated);
        }
      } else {
        // Add new item (start at 3)
        onUpdate([
          ...orderItems,
          {
            item_id: item.id,
            quantity: 3,
            price: getPriceForOrder(item),
          },
        ]);
      }
      setBarcodeInput('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    } else {
      alert(`Item not found for barcode: ${barcode}`);
      setBarcodeInput('');
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  };

  // Handle both Enter and Tab (many barcode scanners send Tab)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      // Clear any pending timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
        barcodeTimeoutRef.current = null;
      }
      handleBarcodeScan(barcodeInput);
    }
  };

  // Timeout-based completion: if input stops for 100ms after rapid typing, treat as complete
  const handleBarcodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setBarcodeInput(value);

    // Clear existing timeout
    if (barcodeTimeoutRef.current) {
      clearTimeout(barcodeTimeoutRef.current);
    }

    // Set new timeout: if no input for 100ms, assume scan is complete
    // This handles barcode scanners that don't send Enter/Tab
    barcodeTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        handleBarcodeScan(value);
      }
    }, 100);
  };

  const handleAddItem = (item: Item) => {
    const existingIndex = orderItems.findIndex((oi) => oi.item_id === item.id);
    if (existingIndex >= 0) {
      // Increment quantity by 3
      const updated = [...orderItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 3,
      };
      onUpdate(updated);
    } else {
      // Add new item (start at 3)
      onUpdate([
        ...orderItems,
        {
          item_id: item.id,
          quantity: 3,
          price: getPriceForOrder(item),
        },
      ]);
    }
    // Clear search after adding
    setSearchQuery('');
    setShowSearchResults(false);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleRemoveItem = (itemId: string) => {
    onUpdate(orderItems.filter((oi) => oi.item_id !== itemId));
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    const updated = orderItems.map((oi) => {
      if (oi.item_id === itemId) {
        const newQuantity = Math.max(0, oi.quantity + delta);
        if (newQuantity === 0) {
          return null;
        }
        return { ...oi, quantity: newQuantity };
      }
      return oi;
    }).filter((oi) => oi !== null) as OrderItem[];
    onUpdate(updated);
  };

  const handleQuantityInputChange = (itemId: string, value: string) => {
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) {
      return; // Don't update if invalid
    }
    
    const updated = orderItems.map((oi) => {
      if (oi.item_id === itemId) {
        if (numValue === 0) {
          return null;
        }
        return { ...oi, quantity: numValue };
      }
      return oi;
    }).filter((oi) => oi !== null) as OrderItem[];
    onUpdate(updated);
  };

  // Calculate total quantity across all items in the order
  const totalQuantity = useMemo(() => {
    return orderItems.reduce((sum, orderItem) => sum + orderItem.quantity, 0);
  }, [orderItems]);

  const getItemById = (itemId: string) => {
    return allItems.find((i) => i.id === itemId);
  };

  // Helper function to check if a price level matches the customer's price level
  const isMatchingPriceLevel = (level: string): boolean => {
    return customerPriceLevel !== undefined && customerPriceLevel === level;
  };

  // Get the price to use when adding items to the order
  // Uses customer's price level if available, otherwise falls back to wholesale (level 4)
  const getPriceForOrder = (item: Item): number | undefined => {
    const priceLevel = customerPriceLevel || '4'; // Default to wholesale if no customer price level
    return getPriceForQuantity(item, priceLevel, totalQuantity);
  };

  // Helper function to get price for a specific level at current total quantity
  const getPriceAtQuantity = (item: Item, level: string): number | undefined => {
    return getPriceForQuantity(item, level, totalQuantity);
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, orderItem) => {
      const itemPrice = orderItem.price || 0;
      return sum + (orderItem.quantity * itemPrice);
    }, 0);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Add Items to Order</h3>
        <div className="flex items-center gap-4">
          <div className="text-lg flex items-center gap-4">
            <div>
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-bold text-xl ml-2">${calculateSubtotal().toFixed(2)}</span>
            </div>
            <div className="border-l pl-4">
              <span className="text-gray-600">Pieces:</span>
              <span className="font-bold text-xl ml-2">{totalQuantity}</span>
            </div>
          </div>
          <button
            onClick={() => setBarcodeMode(!barcodeMode)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              barcodeMode
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            <Barcode size={18} />
            {barcodeMode ? 'Barcode Mode ON' : 'Barcode Mode'}
          </button>
        </div>
      </div>

      <div className="mb-4 relative">
        {barcodeMode ? (
          <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
          <label className="block text-sm font-medium text-green-800 mb-2">
            Scan Barcode
          </label>
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcodeInput}
              onChange={handleBarcodeInput}
              onKeyDown={handleBarcodeKeyDown}
              placeholder="Scan barcode (auto-detects completion)"
              className="w-full px-4 py-3 border-2 border-green-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-lg"
            autoFocus
          />
          <p className="text-xs text-green-700 mt-2">
            Barcode scanner will automatically submit on scan
          </p>
        </div>
        ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search items by ID or name..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim() && searchResults.length > 0) {
                setShowSearchResults(true);
              }
            }}
            onBlur={() => {
              // Delay hiding to allow clicks on results
              setTimeout(() => setShowSearchResults(false), 200);
            }}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        )}
        
        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-y-auto">
            {searchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAddItem(item)}
                className="w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 hover:border-blue-300 transition-colors last:border-b-0"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold">{item.displayname}</div>
                    <div className="text-sm text-gray-600">
                      {item.itemid}
                      {item.color && <span className="ml-2 text-purple-600 font-medium">• {item.color}</span>}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1">
                      {(() => {
                        const msrp = getPriceAtQuantity(item, '1');
                        return msrp !== undefined && (
                          <div className={`text-xs ${isMatchingPriceLevel('1') ? 'bg-yellow-200 font-bold px-2 py-1 rounded' : 'text-gray-500'}`}>
                            MSRP (1): <span className="font-medium">${msrp.toFixed(2)}</span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const promoListed = getPriceAtQuantity(item, '3');
                        return promoListed !== undefined && (
                          <div className={`text-xs ${isMatchingPriceLevel('3') ? 'bg-yellow-200 font-bold px-2 py-1 rounded' : 'text-purple-600'}`}>
                            Promo Listed (3): <span className="font-medium">${promoListed.toFixed(2)}</span>
                          </div>
                        );
                      })()}
                      {(() => {
                        const wholesale = getPriceAtQuantity(item, '4');
                        return wholesale !== undefined && (
                          <div className={`text-xs ${isMatchingPriceLevel('4') ? 'bg-yellow-200 font-bold px-2 py-1 rounded' : 'text-blue-600'}`}>
                            Wholesale (4): <span className="font-medium">${wholesale.toFixed(2)}</span>
                        </div>
                        );
                      })()}
                      {(() => {
                        const promoDist = getPriceAtQuantity(item, '14');
                        return promoDist !== undefined && (
                          <div className={`text-xs ${isMatchingPriceLevel('14') ? 'bg-yellow-200 font-bold px-2 py-1 rounded' : 'text-orange-600'}`}>
                            Promo Distributor (14): <span className="font-medium">${promoDist.toFixed(2)}</span>
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                  <Plus size={18} className="text-blue-600 ml-2" />
                </div>
              </button>
            ))}
          </div>
        )}
        
        {showSearchResults && searchQuery.trim() && searchResults.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
            No items found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Order Items */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Order Items ({orderItems.length})</h4>
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-gray-600" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'none' | 'color' | 'sku')}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="none">No Sort</option>
              <option value="color">Sort by Color</option>
              <option value="sku">Sort by SKU</option>
            </select>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto border rounded-lg p-2">
          {orderItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items in order yet. Search or scan to add items.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(() => {
                // Sort orderItems based on selected sort option
                let sortedItems = [...orderItems];
                
                if (sortBy === 'color') {
                  sortedItems.sort((a, b) => {
                    const itemA = getItemById(a.item_id);
                    const itemB = getItemById(b.item_id);
                    const colorA = itemA?.color || '';
                    const colorB = itemB?.color || '';
                    if (colorA === colorB) {
                      // If same color, sort by SKU
                      return (itemA?.itemid || '').localeCompare(itemB?.itemid || '');
                    }
                    return colorA.localeCompare(colorB);
                  });
                } else if (sortBy === 'sku') {
                  sortedItems.sort((a, b) => {
                    const itemA = getItemById(a.item_id);
                    const itemB = getItemById(b.item_id);
                    return (itemA?.itemid || '').localeCompare(itemB?.itemid || '');
                  });
                }
                
                return sortedItems.map((orderItem) => {
              const item = getItemById(orderItem.item_id);
              if (!item) return null;
              return (
                <div
                  key={orderItem.item_id}
                    className="p-2.5 border border-gray-200 rounded-lg bg-white"
                >
                    <div className="flex justify-between items-start mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{item.displayname}</div>
                        <div className="text-xs text-gray-600">
                          {item.itemid}
                          </div>
                        {item.color && (
                          <div className="text-xs text-purple-600 font-medium mt-0.5">
                            Color: {item.color}
                          </div>
                        )}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(orderItem.item_id)}
                        className="p-2 hover:bg-red-100 rounded flex-shrink-0 ml-2"
                        title="Remove item"
                    >
                        <Trash2 size={20} className="text-red-600" />
                    </button>
                  </div>
                    <div className="mb-1.5">
                      {(() => {
                        const priceLevel = customerPriceLevel || '4';
                        const price = getPriceAtQuantity(item, priceLevel);
                        return price !== undefined && (
                          <div className={`text-xs px-1.5 py-0.5 rounded inline-block ${isMatchingPriceLevel(priceLevel) ? 'bg-yellow-200 font-bold' : 'bg-gray-100'}`}>
                            ${price.toFixed(2)} each
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                    <button
                      onClick={() => handleQuantityChange(orderItem.item_id, -3)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                        <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      value={orderItem.quantity}
                      onChange={(e) => handleQuantityInputChange(orderItem.item_id, e.target.value)}
                        className="font-semibold w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleQuantityChange(orderItem.item_id, 3)}
                      className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                    >
                        <Plus size={14} />
                    </button>
                    {orderItem.price && (
                        <span className="ml-auto text-xs font-semibold text-gray-700">
                        ${(orderItem.quantity * orderItem.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                    <div>
                      <textarea
                        id={`item-note-${orderItem.item_id}`}
                        value={orderItem.notes || ''}
                        onChange={(e) => {
                          const updatedItems = orderItems.map((oi) =>
                            oi.item_id === orderItem.item_id
                              ? { ...oi, notes: e.target.value || undefined }
                              : oi
                          );
                          onUpdate(updatedItems);
                        }}
                        placeholder="Note (optional)..."
                        rows={2}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>
                </div>
              );
                });
              })()}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

