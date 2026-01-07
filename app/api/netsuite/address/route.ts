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
  console.log('=== NetSuite Address API Route Called ===');
  try {
    const { 
      customerId, 
      addr1, 
      addr2, 
      city, 
      state, 
      zip, 
      country, 
      addressee,
      isDefaultShipping,
      isDefaultBilling,
      label
    } = await request.json();
    console.log('Request body received:', { 
      customerId, 
      addr1, 
      addr2, 
      city, 
      state, 
      zip, 
      country, 
      addressee,
      isDefaultShipping,
      isDefaultBilling,
      label
    });

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID (NetSuite ID) is required' },
        { status: 400 }
      );
    }

    if (!addr1) {
      return NextResponse.json(
        { error: 'Address line 1 is required' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    // NetSuite uses PATCH on customer record with addressbook sublist to add addresses
    const url = `${baseUrl}/services/rest/record/v1/customer/${customerId}`;
    const authHeader = getAuthHeader(url, 'PATCH');

    // Build address object for addressbook sublist
    const addressEntry: any = {
      addressbookaddress: {
        addr1: addr1,
      },
    };

    if (addr2) {
      addressEntry.addressbookaddress.addr2 = addr2;
    }
    if (city) {
      addressEntry.addressbookaddress.city = city;
    }
    if (state) {
      addressEntry.addressbookaddress.state = state;
    }
    if (zip) {
      addressEntry.addressbookaddress.zip = zip;
    }
    if (country) {
      addressEntry.addressbookaddress.country = country;
    }
    if (addressee) {
      addressEntry.addressbookaddress.addressee = addressee;
    }
    if (label) {
      addressEntry.label = label;
    }
    if (isDefaultShipping !== undefined) {
      addressEntry.defaultshipping = isDefaultShipping;
    }
    if (isDefaultBilling !== undefined) {
      addressEntry.defaultbilling = isDefaultBilling;
    }

    const requestBody = {
      addressbook: {
        items: [addressEntry],
      },
    };

    console.log('NetSuite PATCH Request:', {
      url,
      method: 'PATCH',
      headers: {
        'Authorization': authHeader.substring(0, 50) + '...',
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    console.log('NetSuite PATCH Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
    });

    if (!response.ok) {
      console.error('NetSuite create address error - Full response:', {
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

    // For PATCH operations, NetSuite returns the updated record
    // We need to parse the response to get the address ID from the addressbook
    let addressId = '';
    try {
      const customerData = JSON.parse(responseText);
      // The addressbook items should contain the new address with its ID
      if (customerData.addressbook && customerData.addressbook.items) {
        const addressbookItems = customerData.addressbook.items;
        // Get the last item (the one we just added)
        const newAddress = addressbookItems[addressbookItems.length - 1];
        if (newAddress && newAddress.addressbookaddress) {
          addressId = newAddress.addressbookaddress.toString();
        }
      }
      console.log('NetSuite address data parsed, address ID:', addressId);
    } catch (parseError) {
      console.error('Error parsing NetSuite response:', parseError);
    }

    return NextResponse.json({
      success: true,
      netsuiteId: addressId,
    });
  } catch (error) {
    console.error('Error creating address in NetSuite:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
