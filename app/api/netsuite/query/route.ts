import { NextRequest, NextResponse } from 'next/server';
import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';

function getAuthHeader(url: string, method: string): string {
  const accountId = process.env.NETSUITE_ACCOUNT_ID || '';
  const consumerKey = process.env.NETSUITE_CONSUMER_KEY || '';
  const consumerSecret = process.env.NETSUITE_CONSUMER_SECRET || '';
  const tokenId = process.env.NETSUITE_TOKEN_ID || '';
  const tokenSecret = process.env.NETSUITE_TOKEN_SECRET || '';

  const oauth = new OAuth({
    consumer: {
      key: consumerKey,
      secret: consumerSecret,
    },
    signature_method: 'HMAC-SHA256',
    hash_function(baseString, key) {
      return CryptoJS.HmacSHA256(baseString, key).toString(CryptoJS.enc.Base64);
    },
  });

  const token = {
    key: tokenId,
    secret: tokenSecret,
  };

  const requestData = {
    url,
    method,
  };

  const authData = oauth.authorize(requestData, token);
  const authHeader = oauth.toHeader(authData);

  // toHeader() returns { Authorization: 'OAuth oauth_consumer_key="...", oauth_token="...", ...' }
  // We need to extract just the oauth parameters and add the realm
  const authHeaderValue = authHeader.Authorization;
  // Remove "OAuth " prefix if present
  const oauthParams = authHeaderValue.replace(/^OAuth\s+/, '');
  
  return `OAuth realm="${accountId}",${oauthParams}`;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Use NETSUITE_URL if provided, otherwise build from account ID
    const netsuiteUrl = process.env.NETSUITE_URL;
    const accountId = process.env.NETSUITE_ACCOUNT_ID || '';
    
    let url: string;
    if (netsuiteUrl) {
      url = netsuiteUrl;
    } else {
      const baseUrl = `https://${accountId}.suitetalk.api.netsuite.com`;
      url = `${baseUrl}/services/rest/query/v1/suiteql`;
    }

    const authHeader = getAuthHeader(url, 'POST');
    console.log('NetSuite request:', { url, query: query.substring(0, 100) });

    // Add limit to initial query to get pagination info
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'transient',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ q: query }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`NetSuite API error ${response.status}:`, errorText);
      return NextResponse.json(
        { error: `NetSuite API error: ${response.status}`, details: errorText, type: 'NETSUITE_API_ERROR' },
        { status: response.status }
      );
    }

    const data = await response.json();
    let allItems = data.items || [];
    
    // Handle pagination using offset parameter (more reliable than following links)
    let offset = 1000; // Start from second page (assuming 1000 per page)
    while (data.hasMore && offset < 10000) { // Safety limit of 10k items
      // Parse the next URL to extract query parameters, or use offset directly
      const paginatedUrl = `${url}?limit=1000&offset=${offset}`;
      const paginatedAuthHeader = getAuthHeader(paginatedUrl, 'POST');
      
      const paginatedResponse = await fetch(paginatedUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Prefer': 'transient',
          'Authorization': paginatedAuthHeader,
        },
        body: JSON.stringify({ q: query }),
      });
      
      if (!paginatedResponse.ok) {
        console.warn(`Failed to fetch page at offset ${offset}: ${paginatedResponse.status}`);
        break;
      }
      
      const paginatedData = await paginatedResponse.json();
      allItems = allItems.concat(paginatedData.items || []);
      
      if (!paginatedData.hasMore) break;
      offset += 1000;
    }
    
    return NextResponse.json({ items: allItems });
  } catch (error: any) {
    console.error('NetSuite query error:', error);
    const errorMessage = error.message || 'Failed to query NetSuite';
    const errorStack = error.stack || '';
    return NextResponse.json(
      { error: errorMessage, details: errorStack, type: 'NETSUITE_ERROR' },
      { status: 500 }
    );
  }
}

