import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    let query = supabase.from('customers').select('*');

    if (search) {
      query = query.or(
        `companyname.ilike.%${search}%,entityid.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data, error } = await query.order('companyname');

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customers: data || [] });
  } catch (error: any) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { customer } = await request.json();

    if (!customer) {
      return NextResponse.json({ error: 'Customer is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('customers')
      .upsert(customer, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ customer: data });
  } catch (error: any) {
    console.error('Error saving customer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}




