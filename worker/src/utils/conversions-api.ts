/**
 * Server-Side Conversions API
 * Facebook Conversions API + Google Ads Enhanced Conversions
 */

import { createHash } from 'crypto';

// ============================================
// Types
// ============================================

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbc?: string; // Facebook click ID
  fbp?: string; // Facebook browser ID
}

interface CustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: string;
  contents?: Array<{
    id: string;
    quantity: number;
    item_price?: number;
  }>;
  numItems?: number;
  orderId?: string;
  searchString?: string;
  status?: string;
}

interface ConversionEvent {
  eventName: string;
  eventTime: number;
  eventId?: string;
  eventSourceUrl?: string;
  actionSource: 'website' | 'email' | 'app' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  userData: UserData;
  customData?: CustomData;
}

interface FacebookConfig {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}

interface GoogleAdsConfig {
  customerId: string;
  conversionActionId: string;
  accessToken: string;
}

// ============================================
// Hash Utilities (for PII normalization)
// ============================================

function sha256Hash(value: string): string {
  return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function normalizePhone(phone: string): string {
  // Remove all non-numeric characters except +
  return phone.replace(/[^\d+]/g, '');
}

function hashUserData(userData: UserData): Record<string, string> {
  const hashed: Record<string, string> = {};

  if (userData.email) {
    hashed.em = sha256Hash(normalizeEmail(userData.email));
  }
  if (userData.phone) {
    hashed.ph = sha256Hash(normalizePhone(userData.phone));
  }
  if (userData.firstName) {
    hashed.fn = sha256Hash(userData.firstName);
  }
  if (userData.lastName) {
    hashed.ln = sha256Hash(userData.lastName);
  }
  if (userData.city) {
    hashed.ct = sha256Hash(userData.city);
  }
  if (userData.state) {
    hashed.st = sha256Hash(userData.state);
  }
  if (userData.zipCode) {
    hashed.zp = sha256Hash(userData.zipCode);
  }
  if (userData.country) {
    hashed.country = sha256Hash(userData.country);
  }
  if (userData.externalId) {
    hashed.external_id = sha256Hash(userData.externalId);
  }

  // Non-hashed fields
  if (userData.clientIpAddress) {
    hashed.client_ip_address = userData.clientIpAddress;
  }
  if (userData.clientUserAgent) {
    hashed.client_user_agent = userData.clientUserAgent;
  }
  if (userData.fbc) {
    hashed.fbc = userData.fbc;
  }
  if (userData.fbp) {
    hashed.fbp = userData.fbp;
  }

  return hashed;
}

// ============================================
// Facebook Conversions API
// ============================================

export async function sendFacebookConversion(
  config: FacebookConfig,
  event: ConversionEvent
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v18.0/${config.pixelId}/events`;

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: event.eventTime,
        event_id: event.eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource,
        user_data: hashUserData(event.userData),
        custom_data: event.customData
          ? {
              value: event.customData.value,
              currency: event.customData.currency || 'USD',
              content_name: event.customData.contentName,
              content_category: event.customData.contentCategory,
              content_ids: event.customData.contentIds,
              content_type: event.customData.contentType,
              contents: event.customData.contents,
              num_items: event.customData.numItems,
              order_id: event.customData.orderId,
              search_string: event.customData.searchString,
              status: event.customData.status,
            }
          : undefined,
      },
    ],
    access_token: config.accessToken,
    ...(config.testEventCode && { test_event_code: config.testEventCode }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.error('Facebook CAPI error:', result);
      return {
        success: false,
        error: result.error?.message || 'Unknown error',
      };
    }

    return {
      success: true,
      eventId: payload.data[0].event_id,
    };
  } catch (error: any) {
    console.error('Facebook CAPI request failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// Google Ads Enhanced Conversions
// ============================================

export async function sendGoogleConversion(
  config: GoogleAdsConfig,
  event: ConversionEvent
): Promise<{ success: boolean; error?: string }> {
  // Google Ads API endpoint
  const url = `https://googleads.googleapis.com/v14/customers/${config.customerId}:uploadConversionAdjustments`;

  // Format conversion for Google Ads
  const conversionAdjustment = {
    conversionAction: `customers/${config.customerId}/conversionActions/${config.conversionActionId}`,
    adjustmentType: 'ENHANCEMENT',
    adjustmentDateTime: new Date(event.eventTime * 1000).toISOString(),
    orderId: event.customData?.orderId,
    userIdentifiers: [] as any[],
  };

  // Add user identifiers (hashed)
  if (event.userData.email) {
    conversionAdjustment.userIdentifiers.push({
      hashedEmail: sha256Hash(normalizeEmail(event.userData.email)),
    });
  }

  if (event.userData.phone) {
    conversionAdjustment.userIdentifiers.push({
      hashedPhoneNumber: sha256Hash(normalizePhone(event.userData.phone)),
    });
  }

  if (event.userData.firstName && event.userData.lastName) {
    conversionAdjustment.userIdentifiers.push({
      addressInfo: {
        hashedFirstName: sha256Hash(event.userData.firstName),
        hashedLastName: sha256Hash(event.userData.lastName),
        city: event.userData.city,
        state: event.userData.state,
        postalCode: event.userData.zipCode,
        countryCode: event.userData.country,
      },
    });
  }

  const payload = {
    conversionAdjustments: [conversionAdjustment],
    partialFailure: true,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
        'developer-token': '', // Requires Google Ads API developer token
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.error('Google Ads API error:', result);
      return {
        success: false,
        error: result.error?.message || 'Unknown error',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Google Ads API request failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// TikTok Events API
// ============================================

interface TikTokConfig {
  pixelId: string;
  accessToken: string;
  testEventCode?: string;
}

export async function sendTikTokConversion(
  config: TikTokConfig,
  event: ConversionEvent
): Promise<{ success: boolean; error?: string }> {
  const url = 'https://business-api.tiktok.com/open_api/v1.3/pixel/track/';

  const payload = {
    pixel_code: config.pixelId,
    event: event.eventName,
    event_id: event.eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(event.eventTime * 1000).toISOString(),
    context: {
      page: {
        url: event.eventSourceUrl,
      },
      user: {
        external_id: event.userData.externalId ? sha256Hash(event.userData.externalId) : undefined,
        email: event.userData.email ? sha256Hash(normalizeEmail(event.userData.email)) : undefined,
        phone_number: event.userData.phone ? sha256Hash(normalizePhone(event.userData.phone)) : undefined,
      },
      ip: event.userData.clientIpAddress,
      user_agent: event.userData.clientUserAgent,
    },
    properties: event.customData
      ? {
          value: event.customData.value,
          currency: event.customData.currency || 'USD',
          content_type: event.customData.contentType,
          content_id: event.customData.contentIds?.join(','),
          contents: event.customData.contents?.map((c) => ({
            content_id: c.id,
            quantity: c.quantity,
            price: c.item_price,
          })),
          num_items: event.customData.numItems,
          order_id: event.customData.orderId,
          query: event.customData.searchString,
        }
      : undefined,
    ...(config.testEventCode && { test_event_code: config.testEventCode }),
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': config.accessToken,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (result.code !== 0) {
      console.error('TikTok Events API error:', result);
      return {
        success: false,
        error: result.message || 'Unknown error',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('TikTok Events API request failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// Pinterest Conversions API
// ============================================

interface PinterestConfig {
  adAccountId: string;
  accessToken: string;
  testMode?: boolean;
}

export async function sendPinterestConversion(
  config: PinterestConfig,
  event: ConversionEvent
): Promise<{ success: boolean; error?: string }> {
  const url = `https://api.pinterest.com/v5/ad_accounts/${config.adAccountId}/events`;

  // Map event names to Pinterest format
  const eventNameMap: Record<string, string> = {
    PageView: 'page_visit',
    ViewContent: 'view_category',
    AddToCart: 'add_to_cart',
    Purchase: 'checkout',
    Lead: 'lead',
    Search: 'search',
    Signup: 'signup',
    WatchVideo: 'watch_video',
  };

  const payload = {
    data: [
      {
        event_name: eventNameMap[event.eventName] || event.eventName.toLowerCase(),
        action_source: event.actionSource === 'website' ? 'web' : event.actionSource,
        event_time: event.eventTime,
        event_id: event.eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        event_source_url: event.eventSourceUrl,
        user_data: {
          em: event.userData.email ? [sha256Hash(normalizeEmail(event.userData.email))] : undefined,
          ph: event.userData.phone ? [sha256Hash(normalizePhone(event.userData.phone))] : undefined,
          fn: event.userData.firstName ? [sha256Hash(event.userData.firstName)] : undefined,
          ln: event.userData.lastName ? [sha256Hash(event.userData.lastName)] : undefined,
          ct: event.userData.city ? [sha256Hash(event.userData.city)] : undefined,
          st: event.userData.state ? [sha256Hash(event.userData.state)] : undefined,
          zp: event.userData.zipCode ? [sha256Hash(event.userData.zipCode)] : undefined,
          country: event.userData.country ? [sha256Hash(event.userData.country)] : undefined,
          external_id: event.userData.externalId ? [sha256Hash(event.userData.externalId)] : undefined,
          client_ip_address: event.userData.clientIpAddress,
          client_user_agent: event.userData.clientUserAgent,
        },
        custom_data: event.customData
          ? {
              value: event.customData.value?.toString(),
              currency: event.customData.currency || 'USD',
              content_name: event.customData.contentName,
              content_category: event.customData.contentCategory,
              content_ids: event.customData.contentIds,
              contents: event.customData.contents?.map((c) => ({
                item_id: c.id,
                quantity: c.quantity,
                item_price: c.item_price?.toString(),
              })),
              num_items: event.customData.numItems,
              order_id: event.customData.orderId,
              search_string: event.customData.searchString,
            }
          : undefined,
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json() as any;

    if (!response.ok) {
      console.error('Pinterest Conversions API error:', result);
      return {
        success: false,
        error: result.message || 'Unknown error',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Pinterest Conversions API request failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================
// Unified Conversion Sender
// ============================================

interface PixelConfig {
  facebook?: FacebookConfig;
  google?: GoogleAdsConfig;
  tiktok?: TikTokConfig;
  pinterest?: PinterestConfig;
}

export async function sendServerConversions(
  config: PixelConfig,
  event: ConversionEvent
): Promise<Record<string, { success: boolean; error?: string }>> {
  const results: Record<string, { success: boolean; error?: string }> = {};

  const promises: Promise<void>[] = [];

  if (config.facebook) {
    promises.push(
      sendFacebookConversion(config.facebook, event).then((r) => {
        results.facebook = r;
      })
    );
  }

  if (config.google) {
    promises.push(
      sendGoogleConversion(config.google, event).then((r) => {
        results.google = r;
      })
    );
  }

  if (config.tiktok) {
    promises.push(
      sendTikTokConversion(config.tiktok, event).then((r) => {
        results.tiktok = r;
      })
    );
  }

  if (config.pinterest) {
    promises.push(
      sendPinterestConversion(config.pinterest, event).then((r) => {
        results.pinterest = r;
      })
    );
  }

  await Promise.allSettled(promises);

  return results;
}

// ============================================
// Helper to build conversion event from order
// ============================================

export function buildPurchaseEvent(
  order: {
    id: string;
    total: number;
    currency?: string;
    items: Array<{ product_id: string; quantity: number; price: number; name?: string }>;
    customer_email: string;
    customer_phone?: string;
    customer_name?: string;
    created_at?: string;
  },
  request: Request
): ConversionEvent {
  const [firstName, ...lastNameParts] = (order.customer_name || '').split(' ');
  const lastName = lastNameParts.join(' ');

  return {
    eventName: 'Purchase',
    eventTime: order.created_at
      ? Math.floor(new Date(order.created_at).getTime() / 1000)
      : Math.floor(Date.now() / 1000),
    eventId: order.id,
    eventSourceUrl: request.headers.get('referer') || undefined,
    actionSource: 'website',
    userData: {
      email: order.customer_email,
      phone: order.customer_phone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      externalId: order.customer_email,
      clientIpAddress: request.headers.get('cf-connecting-ip') || undefined,
      clientUserAgent: request.headers.get('user-agent') || undefined,
      fbc: getCookie(request, '_fbc'),
      fbp: getCookie(request, '_fbp'),
    },
    customData: {
      value: order.total,
      currency: order.currency || 'USD',
      contentIds: order.items.map((i) => i.product_id),
      contentType: 'product',
      contents: order.items.map((i) => ({
        id: i.product_id,
        quantity: i.quantity,
        item_price: i.price,
      })),
      numItems: order.items.reduce((sum, i) => sum + i.quantity, 0),
      orderId: order.id,
    },
  };
}

function getCookie(request: Request, name: string): string | undefined {
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}
