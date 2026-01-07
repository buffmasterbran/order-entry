import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { contacts } = await request.json();

    if (!contacts || !Array.isArray(contacts)) {
      return NextResponse.json({ error: 'Contacts array is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('contacts')
      .upsert(contacts, { onConflict: 'id' })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (error: any) {
    console.error('Error saving contacts:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




