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
  console.log('=== NetSuite Contact API Route Called ===');
  try {
    const { customerId, firstname, lastname, email, phone, title } = await request.json();
    console.log('Request body received:', { customerId, firstname, lastname, email, phone, title });

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID (NetSuite ID) is required' },
        { status: 400 }
      );
    }

    if (!firstname && !lastname) {
      return NextResponse.json(
        { error: 'First name or last name is required' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/services/rest/record/v1/contact`;
    const authHeader = getAuthHeader(url, 'POST');

    const requestBody: any = {
      company: { id: customerId },
    };

    if (firstname) {
      requestBody.firstName = firstname;
    }
    if (lastname) {
      requestBody.lastName = lastname;
    }
    if (email) {
      requestBody.email = email;
    }
    if (phone) {
      requestBody.phone = phone;
    }
    if (title) {
      requestBody.title = title;
    }

    console.log('NetSuite POST Request:', {
      url,
      method: 'POST',
      headers: {
        'Authorization': authHeader.substring(0, 50) + '...',
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const response = await fetch(url, {
      method: 'POST',
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

    console.log('NetSuite POST Response:', {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseText,
    });

    if (!response.ok) {
      console.error('NetSuite create contact error - Full response:', {
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

    // Get the created contact ID from Location header
    const location = response.headers.get('Location');
    if (!location) {
      console.error('No Location header in response. Response was:', {
        status: response.status,
        headers: responseHeaders,
        body: responseText,
      });
      return NextResponse.json(
        { error: 'No Location header in response', details: { status: response.status, body: responseText } },
        { status: 500 }
      );
    }

    console.log('Location header:', location);

    // Extract ID from URL like: /services/rest/record/v1/contact/12345
    const idMatch = location.match(/\/contact\/(\d+)/);
    if (!idMatch) {
      console.error('Could not parse contact ID from Location header:', location);
      return NextResponse.json(
        { error: 'Could not parse contact ID from response', details: { location } },
        { status: 500 }
      );
    }

    const netsuiteId = idMatch[1];
    console.log('Extracted NetSuite contact ID:', netsuiteId);

    // Fetch the created contact to get entityid
    const getUrl = `${baseUrl}/services/rest/record/v1/contact/${netsuiteId}`;
    const getAuthHeaderValue = getAuthHeader(getUrl, 'GET');
    
    console.log('NetSuite GET Request:', {
      url: getUrl,
      method: 'GET',
    });

    const getResponse = await fetch(getUrl, {
      method: 'GET',
      headers: {
        'Authorization': getAuthHeaderValue,
        'Content-Type': 'application/json',
      },
    });

    const getResponseText = await getResponse.text();
    const getResponseHeaders: Record<string, string> = {};
    getResponse.headers.forEach((value, key) => {
      getResponseHeaders[key] = value;
    });

    console.log('NetSuite GET Response:', {
      status: getResponse.status,
      statusText: getResponse.statusText,
      headers: getResponseHeaders,
      body: getResponseText,
    });

    let entityid = '';
    if (getResponse.ok) {
      try {
        const contactData = JSON.parse(getResponseText);
        entityid = contactData.entityId || '';
        console.log('NetSuite contact data parsed:', contactData);
      } catch (parseError) {
        console.error('Error parsing NetSuite GET response:', parseError);
      }
    }

    return NextResponse.json({
      success: true,
      netsuiteId,
      entityid,
    });
  } catch (error) {
    console.error('Error creating contact in NetSuite:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}



