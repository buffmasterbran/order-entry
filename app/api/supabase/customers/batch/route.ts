import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { customers } = await request.json();

    if (!customers || !Array.isArray(customers)) {
      return NextResponse.json({ error: 'Customers array is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('customers')
      .upsert(customers, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data || [] });
  } catch (error: any) {
    console.error('Error saving customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




