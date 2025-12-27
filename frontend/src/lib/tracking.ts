/**
 * Marketing & Tracking Utilities
 * UTM tracking, abandoned cart, Facebook Pixel, Google Ads
 */

const API_BASE_URL = import.meta.env.PUBLIC_API_URL || '';

// Storage keys
const SESSION_KEY = 'dtc_session_id';
const UTM_KEY = 'dtc_utm_params';

// ============================================
// SESSION MANAGEMENT
// ============================================

export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

// ============================================
// UTM PARAMETER PARSING
// ============================================

export interface UTMParams {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export function parseUTMParams(): UTMParams {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const utm: UTMParams = {};
  
  if (params.get('utm_source')) utm.utm_source = params.get('utm_source')!;
  if (params.get('utm_medium')) utm.utm_medium = params.get('utm_medium')!;
  if (params.get('utm_campaign')) utm.utm_campaign = params.get('utm_campaign')!;
  if (params.get('utm_term')) utm.utm_term = params.get('utm_term')!;
  if (params.get('utm_content')) utm.utm_content = params.get('utm_content')!;
  
  return utm;
}

export function getStoredUTM(): UTMParams {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(UTM_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function storeUTM(utm: UTMParams): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Merge with existing (first-touch attribution for source, last-touch for campaign)
    const existing = getStoredUTM();
    const merged = {
      ...existing,
      ...utm,
      // Keep first-touch source if exists
      utm_source: existing.utm_source || utm.utm_source,
    };
    localStorage.setItem(UTM_KEY, JSON.stringify(merged));
  } catch (error) {
    console.error('Error storing UTM:', error);
  }
}

// ============================================
// DEVICE DETECTION
// ============================================

export function getDeviceType(): string {
  if (typeof window === 'undefined') return 'unknown';
  
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

// ============================================
// TRACKING API CALLS
// ============================================

async function trackingRequest<T>(endpoint: string, data: any): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Tracking request error:', error);
    return null;
  }
}

// Record UTM parameters to backend
export async function recordUTM(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const utm = parseUTMParams();
  const hasUTM = Object.keys(utm).length > 0;
  
  // Store locally
  if (hasUTM) {
    storeUTM(utm);
  }
  
  // Send to backend
  await trackingRequest('/api/tracking/utm', {
    session_id: getSessionId(),
    ...getStoredUTM(),
    referrer: document.referrer || null,
    landing_page: window.location.pathname,
    user_agent: navigator.userAgent,
    device_type: getDeviceType(),
  });
}

// Mark UTM as converted (after purchase)
export async function markUTMConverted(orderId: string, customerId?: string): Promise<void> {
  const sessionId = getSessionId();
  
  await fetch(`${API_BASE_URL}/api/tracking/utm/${sessionId}/convert`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, customer_id: customerId }),
  });
}

// ============================================
// ABANDONED CART TRACKING
// ============================================

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

export async function syncCartToServer(
  items: CartItem[],
  subtotal: number,
  customerEmail?: string,
  customerName?: string
): Promise<void> {
  await trackingRequest('/api/tracking/cart', {
    session_id: getSessionId(),
    customer_email: customerEmail,
    customer_name: customerName,
    items,
    subtotal,
    currency: 'USD',
  });
}

export async function markCartRecovered(orderId: string): Promise<void> {
  await trackingRequest('/api/tracking/cart/recover', {
    session_id: getSessionId(),
    order_id: orderId,
  });
}

// ============================================
// PIXEL EVENTS
// ============================================

export type PixelPlatform = 'facebook' | 'google' | 'tiktok' | 'pinterest';
export type PixelEventName = 
  | 'PageView'
  | 'ViewContent'
  | 'AddToCart'
  | 'InitiateCheckout'
  | 'AddPaymentInfo'
  | 'Purchase'
  | 'Lead'
  | 'CompleteRegistration'
  | 'Search'
  | 'CustomEvent';

export interface PixelEventData {
  platform: PixelPlatform;
  event_name: PixelEventName;
  custom_event_name?: string;
  currency?: string;
  value?: number;
  content_ids?: string[];
  content_type?: string;
  num_items?: number;
  order_id?: string;
  user_email?: string;
  user_phone?: string;
  event_data?: Record<string, any>;
}

// Record pixel event to backend (for server-side tracking)
export async function recordPixelEvent(data: PixelEventData): Promise<void> {
  await trackingRequest('/api/tracking/pixel', {
    ...data,
    session_id: getSessionId(),
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
}

// ============================================
// FACEBOOK PIXEL
// ============================================

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export function initFacebookPixel(pixelId: string): void {
  if (typeof window === 'undefined' || !pixelId) return;
  
  // Facebook Pixel base code
  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  
  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
}

export function fbTrack(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  
  window.fbq?.('track', eventName, params);
  
  // Also record to backend for server-side tracking
  recordPixelEvent({
    platform: 'facebook',
    event_name: eventName as PixelEventName,
    ...params,
  });
}

export function fbTrackViewContent(contentId: string, contentName: string, value: number): void {
  fbTrack('ViewContent', {
    content_ids: [contentId],
    content_name: contentName,
    content_type: 'product',
    value,
    currency: 'USD',
  });
}

export function fbTrackAddToCart(contentId: string, contentName: string, value: number, quantity: number = 1): void {
  fbTrack('AddToCart', {
    content_ids: [contentId],
    content_name: contentName,
    content_type: 'product',
    value,
    currency: 'USD',
    num_items: quantity,
  });
}

export function fbTrackInitiateCheckout(contentIds: string[], value: number, numItems: number): void {
  fbTrack('InitiateCheckout', {
    content_ids: contentIds,
    content_type: 'product',
    value,
    currency: 'USD',
    num_items: numItems,
  });
}

export function fbTrackPurchase(orderId: string, value: number, contentIds: string[], numItems: number): void {
  fbTrack('Purchase', {
    content_ids: contentIds,
    content_type: 'product',
    value,
    currency: 'USD',
    num_items: numItems,
    order_id: orderId,
  });
}

// ============================================
// GOOGLE ADS / GTAG
// ============================================

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function initGoogleAds(adsId: string): void {
  if (typeof window === 'undefined' || !adsId) return;
  
  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${adsId}`;
  document.head.appendChild(script);
  
  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', adsId);
}

export function gtagTrack(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', eventName, params);
  
  // Also record to backend
  recordPixelEvent({
    platform: 'google',
    event_name: eventName as PixelEventName,
    ...params,
  });
}

export function gtagTrackConversion(conversionId: string, conversionLabel: string, value: number, orderId?: string): void {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', 'conversion', {
    send_to: `${conversionId}/${conversionLabel}`,
    value,
    currency: 'USD',
    transaction_id: orderId,
  });
  
  recordPixelEvent({
    platform: 'google',
    event_name: 'Purchase',
    value,
    currency: 'USD',
    order_id: orderId,
  });
}

export function gtagTrackViewItem(itemId: string, itemName: string, value: number): void {
  gtagTrack('view_item', {
    currency: 'USD',
    value,
    items: [{ item_id: itemId, item_name: itemName, price: value }],
  });
}

export function gtagTrackAddToCart(itemId: string, itemName: string, value: number, quantity: number = 1): void {
  gtagTrack('add_to_cart', {
    currency: 'USD',
    value,
    items: [{ item_id: itemId, item_name: itemName, price: value, quantity }],
  });
}

export function gtagTrackBeginCheckout(items: Array<{ id: string; name: string; price: number; quantity: number }>, value: number): void {
  gtagTrack('begin_checkout', {
    currency: 'USD',
    value,
    items: items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
}

export function gtagTrackPurchase(
  orderId: string,
  value: number,
  items: Array<{ id: string; name: string; price: number; quantity: number }>
): void {
  gtagTrack('purchase', {
    transaction_id: orderId,
    currency: 'USD',
    value,
    items: items.map(i => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity })),
  });
}

// ============================================
// TIKTOK PIXEL
// ============================================

declare global {
  interface Window {
    ttq?: any;
  }
}

export function initTikTokPixel(pixelId: string): void {
  if (typeof window === 'undefined' || !pixelId) return;
  
  // TikTok Pixel base code
  (function(w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t;
    const ttq = w[t] = w[t] || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function(t: any, e: any) {
      t[e] = function() {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }
    ttq.instance = function(t: any) {
      const e = ttq._i[t] || [];
      for (let n = 0; n < ttq.methods.length; n++) {
        ttq.setAndDefer(e, ttq.methods[n]);
      }
      return e;
    };
    ttq.load = function(e: any, n?: any) {
      const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      const o = document.createElement('script');
      o.type = 'text/javascript';
      o.async = true;
      o.src = i + '?sdkid=' + e + '&lib=' + t;
      const a = document.getElementsByTagName('script')[0];
      a.parentNode?.insertBefore(o, a);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, 'ttq');
}

export function ttqTrack(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.ttq) return;
  
  window.ttq.track(eventName, params);
  
  // Also record to backend
  recordPixelEvent({
    platform: 'tiktok',
    event_name: eventName as PixelEventName,
    ...params,
  });
}

export function ttqTrackViewContent(contentId: string, contentName: string, value: number): void {
  ttqTrack('ViewContent', {
    content_id: contentId,
    content_name: contentName,
    content_type: 'product',
    value,
    currency: 'USD',
  });
}

export function ttqTrackAddToCart(contentId: string, contentName: string, value: number, quantity: number = 1): void {
  ttqTrack('AddToCart', {
    content_id: contentId,
    content_name: contentName,
    content_type: 'product',
    value,
    currency: 'USD',
    quantity,
  });
}

export function ttqTrackInitiateCheckout(value: number, numItems: number): void {
  ttqTrack('InitiateCheckout', {
    value,
    currency: 'USD',
    quantity: numItems,
  });
}

export function ttqTrackCompletePayment(orderId: string, value: number, numItems: number): void {
  ttqTrack('CompletePayment', {
    value,
    currency: 'USD',
    quantity: numItems,
    content_type: 'product',
  });
  
  recordPixelEvent({
    platform: 'tiktok',
    event_name: 'Purchase',
    value,
    currency: 'USD',
    order_id: orderId,
    num_items: numItems,
  });
}

// ============================================
// PINTEREST TAG
// ============================================

declare global {
  interface Window {
    pintrk?: any;
  }
}

export function initPinterestTag(tagId: string): void {
  if (typeof window === 'undefined' || !tagId) return;
  
  // Pinterest Tag base code
  (function(e: string) {
    if (!window.pintrk) {
      const pintrk: any = function() {
        pintrk.queue.push(Array.prototype.slice.call(arguments));
      };
      pintrk.queue = [];
      pintrk.version = '3.0';
      window.pintrk = pintrk;
      const t = document.createElement('script');
      t.async = true;
      t.src = e;
      const r = document.getElementsByTagName('script')[0];
      r.parentNode?.insertBefore(t, r);
    }
  })('https://s.pinimg.com/ct/core.js');
  
  window.pintrk?.('load', tagId);
  window.pintrk?.('page');
}

export function pintrkTrack(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined' || !window.pintrk) return;
  
  window.pintrk('track', eventName, params);
  
  // Also record to backend
  recordPixelEvent({
    platform: 'pinterest',
    event_name: eventName as PixelEventName,
    ...params,
  });
}

export function pintrkTrackPageVisit(): void {
  pintrkTrack('pagevisit');
}

export function pintrkTrackViewCategory(categoryName: string): void {
  pintrkTrack('viewcategory', {
    category_name: categoryName,
  });
}

export function pintrkTrackAddToCart(productId: string, productName: string, value: number, quantity: number = 1): void {
  pintrkTrack('addtocart', {
    product_id: productId,
    product_name: productName,
    value,
    order_quantity: quantity,
    currency: 'USD',
  });
}

export function pintrkTrackCheckout(value: number, numItems: number): void {
  pintrkTrack('checkout', {
    value,
    order_quantity: numItems,
    currency: 'USD',
  });
}

export function pintrkTrackPurchase(orderId: string, value: number, numItems: number): void {
  pintrkTrack('checkout', {
    value,
    order_quantity: numItems,
    currency: 'USD',
    order_id: orderId,
  });
  
  recordPixelEvent({
    platform: 'pinterest',
    event_name: 'Purchase',
    value,
    currency: 'USD',
    order_id: orderId,
    num_items: numItems,
  });
}

// ============================================
// UNIFIED TRACKING HELPER
// ============================================

export interface TrackingConfig {
  facebookPixelId?: string;
  googleAdsId?: string;
  googleConversionLabel?: string;
  tiktokPixelId?: string;
  pinterestTagId?: string;
}

let trackingConfig: TrackingConfig = {};

export function initTracking(config: TrackingConfig): void {
  trackingConfig = config;
  
  if (config.facebookPixelId) {
    initFacebookPixel(config.facebookPixelId);
  }
  
  if (config.googleAdsId) {
    initGoogleAds(config.googleAdsId);
  }
  
  if (config.tiktokPixelId) {
    initTikTokPixel(config.tiktokPixelId);
  }
  
  if (config.pinterestTagId) {
    initPinterestTag(config.pinterestTagId);
  }
  
  // Record UTM on page load
  recordUTM();
}

// Unified tracking functions that fire to all configured platforms
export function trackPageView(): void {
  if (trackingConfig.facebookPixelId && window.fbq) {
    window.fbq('track', 'PageView');
  }
  if (trackingConfig.googleAdsId && window.gtag) {
    window.gtag('event', 'page_view');
  }
  if (trackingConfig.tiktokPixelId && window.ttq) {
    window.ttq.page();
  }
  if (trackingConfig.pinterestTagId && window.pintrk) {
    pintrkTrackPageVisit();
  }
}

export function trackViewContent(productId: string, productName: string, price: number): void {
  if (trackingConfig.facebookPixelId) {
    fbTrackViewContent(productId, productName, price);
  }
  if (trackingConfig.googleAdsId) {
    gtagTrackViewItem(productId, productName, price);
  }
  if (trackingConfig.tiktokPixelId) {
    ttqTrackViewContent(productId, productName, price);
  }
}

export function trackAddToCart(productId: string, productName: string, price: number, quantity: number = 1): void {
  if (trackingConfig.facebookPixelId) {
    fbTrackAddToCart(productId, productName, price, quantity);
  }
  if (trackingConfig.googleAdsId) {
    gtagTrackAddToCart(productId, productName, price, quantity);
  }
  if (trackingConfig.tiktokPixelId) {
    ttqTrackAddToCart(productId, productName, price, quantity);
  }
  if (trackingConfig.pinterestTagId) {
    pintrkTrackAddToCart(productId, productName, price, quantity);
  }
}

export function trackInitiateCheckout(
  items: Array<{ id: string; name: string; price: number; quantity: number }>,
  value: number
): void {
  const contentIds = items.map(i => i.id);
  const numItems = items.reduce((sum, i) => sum + i.quantity, 0);
  
  if (trackingConfig.facebookPixelId) {
    fbTrackInitiateCheckout(contentIds, value, numItems);
  }
  if (trackingConfig.googleAdsId) {
    gtagTrackBeginCheckout(items, value);
  }
  if (trackingConfig.tiktokPixelId) {
    ttqTrackInitiateCheckout(value, numItems);
  }
  if (trackingConfig.pinterestTagId) {
    pintrkTrackCheckout(value, numItems);
  }
}

export function trackPurchase(
  orderId: string,
  value: number,
  items: Array<{ id: string; name: string; price: number; quantity: number }>
): void {
  const contentIds = items.map(i => i.id);
  const numItems = items.reduce((sum, i) => sum + i.quantity, 0);
  
  if (trackingConfig.facebookPixelId) {
    fbTrackPurchase(orderId, value, contentIds, numItems);
  }
  if (trackingConfig.googleAdsId) {
    if (trackingConfig.googleConversionLabel) {
      gtagTrackConversion(trackingConfig.googleAdsId, trackingConfig.googleConversionLabel, value, orderId);
    }
    gtagTrackPurchase(orderId, value, items);
  }
  if (trackingConfig.tiktokPixelId) {
    ttqTrackCompletePayment(orderId, value, numItems);
  }
  if (trackingConfig.pinterestTagId) {
    pintrkTrackPurchase(orderId, value, numItems);
  }
  
  // Mark UTM and cart as converted
  markUTMConverted(orderId);
  markCartRecovered(orderId);
}
