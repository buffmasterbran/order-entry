import { Order } from './supabase';
import { storage } from './storage';

export async function syncOrdersToSupabase(): Promise<{ synced: number; errors: string[] }> {
  const draftOrders = await storage.getDraftOrders();
  
  if (draftOrders.length === 0) {
    return { synced: 0, errors: [] };
  }

  try {
    const response = await fetch('/api/sync/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orders: draftOrders }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync orders');
    }

    // Update order status to synced
    const syncedOrders = draftOrders.map((order) => ({
      ...order,
      status: 'synced' as const,
      synced_at: new Date().toISOString(),
    }));

    for (const order of syncedOrders) {
      await storage.saveOrder(order);
    }

    return { synced: syncedOrders.length, errors: [] };
  } catch (error: any) {
    console.error('Error syncing orders:', error);
    return { synced: 0, errors: [error.message || 'Failed to sync orders'] };
  }
}

