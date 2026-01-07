import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Fetch user's sales_rep_id from database
  let salesRepId: string | null = null;
  if (supabaseAdmin) {
    try {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('sales_rep_id')
        .eq('id', session.userId)
        .single();
      
      if (userData) {
        salesRepId = userData.sales_rep_id || null;
      }
    } catch (error) {
      console.error('Error fetching sales_rep_id:', error);
    }
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      username: session.username,
      isAdmin: session.isAdmin,
      salesRepId: salesRepId,
    },
  });
}


