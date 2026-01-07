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
    hash_function(baseString: string, key: string): string {
      return CryptoJS.HmacSHA256(baseString, key).toString(CryptoJS.enc.Base64);
    },
  });

  const token = {
    key: tokenId,
    secret: tokenSecret,
  };

  const requestData = { url, method };
  const authData = oauth.authorize(requestData, token);
  const authHeader = oauth.toHeader(authData);
  const realm = accountId;
  
  const authHeaderValue = authHeader.Authorization.replace(/^OAuth\s+/, '');
  return `OAuth realm="${realm}",${authHeaderValue}`;
}

function getBaseUrl(): string {
  const netsuiteUrl = process.env.NETSUITE_URL;
  const accountId = process.env.NETSUITE_ACCOUNT_ID || '';
  
  if (netsuiteUrl) {
    return netsuiteUrl.replace('/services/rest/query/v1/suiteql', '');
  } else {
    return `https://${accountId}.suitetalk.api.netsuite.com`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { customerId, shipAddressId, billAddressId, items, shipDate, memo } = await request.json();

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Order items are required' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/services/rest/record/v1/salesOrder`;
    const authHeader = getAuthHeader(url, 'POST');

    const requestBody: any = {
      entity: {
        id: customerId,
      },
      item: items.map((item: { itemId: string; quantity: number; price?: number }) => ({
        item: { id: item.itemId },
        quantity: item.quantity,
        ...(item.price && { rate: item.price }),
      })),
    };

    if (shipAddressId) {
      requestBody.shipAddress = { id: shipAddressId };
    }

    if (billAddressId) {
      requestBody.billAddress = { id: billAddressId };
    }

    if (shipDate) {
      // Format as YYYY-MM-DD
      requestBody.shipDate = shipDate.split('T')[0];
    }

    if (memo) {
      requestBody.memo = memo;
    }

    console.log('NetSuite POST Order Request:', {
      url,
      method: 'POST',
      headers: {
        'Authorization': authHeader.substring(0, 50) + '...', // Log partial auth header for security
        'Content-Type': 'application/json',
        'Prefer': 'respond-async',
      },
      body: requestBody,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Prefer': 'respond-async',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    console.log('NetSuite POST Order Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
    });

    if (!response.ok) {
      console.error('NetSuite create order error - Full response:', {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseText,
      });
      return NextResponse.json(
        { error: `NetSuite API error: ${response.status}`, details: responseText },
        { status: response.status }
      );
    }

    // Get the created order ID from Location header
    const location = response.headers.get('Location');
    if (!location) {
      return NextResponse.json(
        { error: 'No Location header in response' },
        { status: 500 }
      );
    }

    const idMatch = location.match(/\/salesOrder\/(\d+)/);
    if (!idMatch) {
      return NextResponse.json(
        { error: 'Could not parse order ID from response' },
        { status: 500 }
      );
    }

    const netsuiteId = idMatch[1];

    return NextResponse.json({
      success: true,
      netsuiteId,
    });
  } catch (error) {
    console.error('Error creating order in NetSuite:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

