import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { addresses } = await request.json();

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json({ error: 'Addresses array is required' }, { status: 400 });
    }

    // Deduplicate addresses by ID before upserting (keep last occurrence)
    const uniqueAddresses = Array.from(
      new Map(addresses.map(addr => [addr.id, addr])).values()
    );

    if (uniqueAddresses.length !== addresses.length) {
      console.warn(`Deduplicated ${addresses.length} addresses to ${uniqueAddresses.length} unique addresses`);
    }

    // Upsert addresses in smaller batches to avoid duplicate key errors
    const batchSize = 100;
    const results = [];
    for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
      const batch = uniqueAddresses.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('addresses')
        .upsert(batch, { onConflict: 'id' })
        .select();
      
      if (error) {
        console.error(`Supabase error on batch ${i / batchSize + 1}:`, error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      
      results.push(...(data || []));
    }

    return NextResponse.json({ addresses: results });
  } catch (error: any) {
    console.error('Error saving addresses:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

