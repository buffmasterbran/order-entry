import OAuth from 'oauth-1.0a';
import CryptoJS from 'crypto-js';
import { supabaseAdmin } from './supabase';
import { createSession } from './session';

interface NetSuiteEmployee {
  empid: string;
  name: string;
  pawsUsername: string;
  pawsPassword: string;
  custentity_pir_emp_admin_rights: boolean;
  custentity_pir_employee_sales_rep?: string; // NetSuite ID of the sales rep (partner) this employee is tied to
}

interface NetSuiteResponse {
  employees: NetSuiteEmployee[];
}

function generateOAuthHeader(url: string, method: string = 'GET'): string {
  const accountId = process.env.NETSUITE_ACCOUNT_ID || '7913744';
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
  
  // Extract OAuth parameters and add realm
  const authHeaderValue = authHeader.Authorization.replace(/^OAuth\s+/, '');
  return `OAuth realm="${realm}",${authHeaderValue}`;
}

export async function authenticateUser(
  username: string,
  password: string
): Promise<
  | { success: true; isAdmin: boolean; userId: string }
  | { success: false; error: string; details?: any }
> {
  try {
    const restletUrl = 'https://7913744.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=2276&deploy=1';
    const authHeader = generateOAuthHeader(restletUrl, 'GET');

    const response = await fetch(restletUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to authenticate with NetSuite (${response.status}: ${response.statusText})`,
        details: { status: response.status, statusText: response.statusText, body: responseText },
      };
    }

    let data: NetSuiteResponse;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: 'Invalid JSON response from NetSuite',
        details: { rawResponse: responseText },
      };
    }

    if (!data.employees || !Array.isArray(data.employees)) {
      return {
        success: false,
        error: 'Invalid response from NetSuite - employees array not found',
        details: { receivedData: data },
      };
    }

    // Find matching user by username (case-insensitive)
    const employee = data.employees.find(
      (emp) => emp.pawsUsername.toLowerCase() === username.toLowerCase()
    );

    if (!employee) {
      return {
        success: false,
        error: 'Invalid username or password',
        details: { searchedUsername: username },
      };
    }

    // Compare password directly (plaintext comparison)
    if (employee.pawsPassword !== password) {
      return {
        success: false,
        error: 'Invalid username or password',
        details: { passwordMatch: false },
      };
    }

    if (!supabaseAdmin) {
      return {
        success: false,
        error: 'Supabase admin client not configured',
      };
    }

    // Log the employee data to debug sales_rep_id
    console.log('[NetSuite Auth] Employee data:', {
      empid: employee.empid,
      username: employee.pawsUsername,
      sales_rep: employee.custentity_pir_employee_sales_rep,
      sales_rep_type: typeof employee.custentity_pir_employee_sales_rep,
    });

    // Upsert user into Supabase (shared users table)
    const { data: userData, error: upsertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          netsuite_id: employee.empid,
          username: employee.pawsUsername,
          full_name: employee.name || employee.pawsUsername,
          is_admin: employee.custentity_pir_emp_admin_rights || false,
          sales_rep_id: employee.custentity_pir_employee_sales_rep || null,
          last_login: new Date().toISOString(),
        },
        {
          onConflict: 'netsuite_id',
        }
      )
      .select()
      .single();

    if (upsertError || !userData) {
      console.error('Error upserting user:', upsertError);
      return { success: false, error: 'Failed to create user session' };
    }

    // Create session cookie
    await createSession({
      userId: userData.id,
      username: userData.username,
      isAdmin: userData.is_admin,
      netsuiteId: userData.netsuite_id,
    });

    return {
      success: true,
      isAdmin: userData.is_admin,
      userId: userData.id,
    };
  } catch (error) {
    console.error('[NetSuite Auth] Exception:', error);
    return {
      success: false,
      error: 'Authentication failed',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}


