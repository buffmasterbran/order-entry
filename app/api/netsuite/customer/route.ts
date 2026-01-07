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
  console.log('=== NetSuite Customer API Route Called ===');
  try {
    const { 
      companyname, 
      email, 
      subsidiary, 
      partner, 
      customerCategory, 
      priceLevel, 
      customerSalesChannel, 
      customerSource 
    } = await request.json();
    console.log('Request body received:', { 
      companyname, 
      email, 
      subsidiary, 
      partner, 
      customerCategory, 
      priceLevel, 
      customerSalesChannel, 
      customerSource 
    });

    if (!companyname) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/services/rest/record/v1/customer`;
    const authHeader = getAuthHeader(url, 'POST');

    const requestBody: any = {
      companyName: companyname,
    };

    if (email) {
      requestBody.email = email;
    }

    // Required NetSuite fields
    if (subsidiary) {
      requestBody.subsidiary = { id: subsidiary };
    }
    if (partner) {
      requestBody.partner = { id: partner };
    }
    if (customerCategory) {
      requestBody.custentity_customer_category = { id: customerCategory };
    }
    if (priceLevel) {
      requestBody.priceLevel = { id: priceLevel };
    }
    if (customerSalesChannel) {
      requestBody.custentity_customer_sales_channel = { id: customerSalesChannel };
    }
    if (customerSource) {
      requestBody.custentity_pir_cust_source = { id: customerSource };
    }

    console.log('NetSuite POST Request:', {
      url,
      method: 'POST',
      headers: {
        'Authorization': authHeader.substring(0, 50) + '...', // Log partial auth header for security
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
      console.error('NetSuite create customer error - Full response:', {
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

    // Get the created customer ID from Location header
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

    // Extract ID from URL like: /services/rest/record/v1/customer/12345
    const idMatch = location.match(/\/customer\/(\d+)/);
    if (!idMatch) {
      console.error('Could not parse customer ID from Location header:', location);
      return NextResponse.json(
        { error: 'Could not parse customer ID from response', details: { location } },
        { status: 500 }
      );
    }

    const netsuiteId = idMatch[1];
    console.log('Extracted NetSuite customer ID:', netsuiteId);

    // Fetch the created customer to get entityid
    const getUrl = `${baseUrl}/services/rest/record/v1/customer/${netsuiteId}`;
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
        const customerData = JSON.parse(getResponseText);
        entityid = customerData.entityId || '';
        console.log('NetSuite customer data parsed:', customerData);
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
    console.error('Error creating customer in NetSuite:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

