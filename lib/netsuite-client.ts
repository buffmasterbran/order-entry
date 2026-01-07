// Client-side NetSuite API wrapper that uses API routes

export class NetSuiteClient {
  private async query(query: string): Promise<any[]> {
    const response = await fetch('/api/netsuite/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.json();
      const errorMessage = error.details ? `${error.error}: ${error.details}` : error.error || 'NetSuite API error';
      console.error('NetSuite client error:', error);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.items || [];
  }

  async getCustomers(): Promise<any[]> {
    const query = `SELECT id, entityid, companyname, email, partner, pricelevel FROM customer WHERE custentity_customer_category != 28`;
    return this.query(query);
  }

  async getCustomerAddresses(customerId: string): Promise<any[]> {
    const query = `SELECT 
      eab.addressbookaddress AS id, 
      eab.entity, 
      ea.addr1 AS address1, 
      ea.addr2 AS address2, 
      ea.city, 
      ea.state, 
      ea.zip, 
      ea.country, 
      eab.defaultbilling, 
      eab.defaultshipping 
    FROM entityaddressbook eab 
    JOIN entityaddress ea ON ea.nkey = eab.addressbookaddress 
    WHERE eab.entity = ${customerId}`;
    return this.query(query);
  }

  async getCustomerContacts(customerId: string): Promise<any[]> {
    const query = `SELECT 
      contact.id,
      contact.entityid,
      contact.firstname,
      contact.lastname,
      contact.email,
      contact.phone,
      contact.title
    FROM contact 
    WHERE contact.company = ${customerId}`;
    return this.query(query);
  }

  async getItems(): Promise<any[]> {
    // Get all price breaks from NetSuite
    // NetSuite price_break_qty maps to quantities: 1=1, 2=1, 3=24, 4=48, 5=192, 6=480, 7=960
    const query = `SELECT 
      i.id,
      i.itemid,
      i.displayname,
      i.itemtype,
      i.custitem_item_color,
      ip.pricelevel,
      ip.priceqty AS price_break_qty,
      ip.price
    FROM item i 
    JOIN itemprice ip ON ip.item = i.id 
    WHERE i.itemtype IN ('InvtPart','Kit') 
      AND i.isinactive = 'F'
      AND ip.priceqty >= 1
      AND ip.priceqty <= 7
    ORDER BY i.itemid, ip.pricelevel, ip.priceqty`;
    return this.query(query);
  }

  async getAllContacts(): Promise<any[]> {
    const query = `SELECT c.id AS customer_id, c.entityid AS customer_name, ct.id AS contact_id, ct.entityid AS contact_entityid, ct.firstname, ct.lastname, ct.email, ct.phone FROM customer c JOIN contact ct ON ct.company = c.id WHERE c.custentity_customer_category != 28 ORDER BY c.entityid`;
    return this.query(query);
  }

  async getAllAddresses(): Promise<any[]> {
    const query = `SELECT ab.entity AS customer_id, c.entityid AS customer_name, ea.addressee, ea.addr1, ea.addr2, ea.city, ea.state, ea.zip, ea.country, ab.label, ab.defaultshipping, ab.defaultbilling FROM customeraddressbook ab JOIN customer c ON c.id = ab.entity JOIN entityaddress ea ON ea.nkey = ab.addressbookaddress WHERE c.custentity_customer_category != 28`;
    return this.query(query);
  }
}

export const netsuiteClient = new NetSuiteClient();

