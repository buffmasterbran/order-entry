import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let query = supabase.from('items').select('*');

    if (search) {
      query = query.or(`itemid.ilike.%${search}%,displayname.ilike.%${search}%`);
    }

    const { data, error } = await query.order('itemid');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items: data || [] });
  } catch (error: any) {
    console.error('Error fetching items:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { item } = await request.json();

    if (!item) {
      return NextResponse.json({ error: 'Item is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('items')
      .upsert(item, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data });
  } catch (error: any) {
    console.error('Error saving item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

