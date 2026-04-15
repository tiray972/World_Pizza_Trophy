// lib/analytics.ts
// Service de tracking pour capturer les pages vues et événements utilisateur

import { db } from '@/lib/firebase/client';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { TrackingEvent, PageView, TrackingEventType, AnalyticsSummary } from '@/types/firestore';

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

const SESSION_KEY = 'wpt_analytics_session';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

function generateSessionId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    const session = JSON.parse(stored);
    if (Date.now() - session.timestamp < SESSION_DURATION_MS) {
      // Update timestamp
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        id: session.id,
        timestamp: Date.now(),
      }));
      return session.id;
    }
  }

  // Create new session
  const newSessionId = generateSessionId();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    id: newSessionId,
    timestamp: Date.now(),
  }));
  return newSessionId;
}

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  // This will be populated by your auth system
  // For now, we'll check localStorage or return null
  const userData = localStorage.getItem('wpt_user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      return user.uid || null;
    } catch {
      return null;
    }
  }
  return null;
}

// ============================================================================
// HELPER - Remove undefined values for Firestore
// ============================================================================

function cleanUndefinedValues(obj: Record<string, any>): Record<string, any> {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ============================================================================
// PAGE VIEW TRACKING
// ============================================================================

let lastPageViewPath: string | null = null;
let lastPageViewTime: number = 0;
const MIN_PAGE_VIEW_INTERVAL = 2000; // Minimum 2 seconds between page views of same path

export async function trackPageView(path?: string, title?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  const currentPath = path || window.location.pathname;
  const currentTime = Date.now();

  // Prevent duplicate page views
  if (currentPath === lastPageViewPath && currentTime - lastPageViewTime < MIN_PAGE_VIEW_INTERVAL) {
    return;
  }

  lastPageViewPath = currentPath;
  lastPageViewTime = currentTime;

  // Get performance metrics
  const perf = (window as any).performance;
  let loadTime: number | undefined;
  let domContentLoaded: number | undefined;

  if (perf && perf.timing) {
    loadTime = perf.timing.loadEventEnd - perf.timing.navigationStart;
    domContentLoaded = perf.timing.domContentLoadedEventEnd - perf.timing.navigationStart;
  }

  const pageViewData = cleanUndefinedValues({
    path: currentPath,
    title: title || document.title,
    referrer: document.referrer || null,
    userAgent: navigator.userAgent,
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    timestamp: new Date(),
    loadTime: loadTime || null,
    domContentLoaded: domContentLoaded || null,
  });

  try {
    await addDoc(collection(db, 'pageViews'), {
      ...pageViewData,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to track page view:', error);
  }
}

// ============================================================================
// EVENT TRACKING
// ============================================================================

export async function trackEvent(
  eventType: TrackingEventType,
  metadata?: Record<string, any>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const eventData = cleanUndefinedValues({
    eventType,
    timestamp: new Date(),
    userId: getCurrentUserId(),
    sessionId: getSessionId(),
    path: window.location.pathname,
    metadata: metadata || null,
  });

  try {
    await addDoc(collection(db, 'trackingEvents'), {
      ...eventData,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

// Predefined event trackers
export const analytics = {
  // Page view is handled by trackPageView

  trackClick: (element: string, metadata?: Record<string, any>) =>
    trackEvent('click', { element, ...metadata }),

  trackFormSubmit: (formName: string, metadata?: Record<string, any>) =>
    trackEvent('form_submit', { formName, ...metadata }),

  trackRegistrationStart: (metadata?: Record<string, any>) =>
    trackEvent('registration_start', metadata),

  trackRegistrationComplete: (metadata?: Record<string, any>) =>
    trackEvent('registration_complete', metadata),

  trackPaymentStart: (amount?: number, metadata?: Record<string, any>) =>
    trackEvent('payment_start', { amount, ...metadata }),

  trackPaymentComplete: (amount?: number, metadata?: Record<string, any>) =>
    trackEvent('payment_complete', { amount, ...metadata }),

  trackSlotSelect: (slotId: string, metadata?: Record<string, any>) =>
    trackEvent('slot_select', { slotId, ...metadata }),

  trackSlotBook: (slotId: string, metadata?: Record<string, any>) =>
    trackEvent('slot_book', { slotId, ...metadata }),

  trackLogin: (method?: string) =>
    trackEvent('login', { method }),

  trackLogout: () =>
    trackEvent('logout'),

  trackError: (error: Error, metadata?: Record<string, any>) =>
    trackEvent('error', {
      message: error.message,
      stack: error.stack,
      ...metadata
    }),

  trackScroll: (depth: number, metadata?: Record<string, any>) =>
    trackEvent('scroll', { depth, ...metadata }),
};

// ============================================================================
// ANALYTICS DATA FETCHING
// ============================================================================

export async function getPageViews(
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 1000
): Promise<PageView[]> {
  let q = query(
    collection(db, 'pageViews'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );

  if (startDate) {
    q = query(q, where('timestamp', '>=', Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    q = query(q, where('timestamp', '<=', Timestamp.fromDate(endDate)));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
    } as PageView;
  });
}

export async function getTrackingEvents(
  eventType?: TrackingEventType,
  startDate?: Date,
  endDate?: Date,
  limitCount: number = 1000
): Promise<TrackingEvent[]> {
  let constraints: any[] = [orderBy('timestamp', 'desc'), limit(limitCount)];

  if (eventType) {
    constraints.unshift(where('eventType', '==', eventType));
  }
  if (startDate) {
    constraints.unshift(where('timestamp', '>=', Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.unshift(where('timestamp', '<=', Timestamp.fromDate(endDate)));
  }

  const q = query(collection(db, 'trackingEvents'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
    } as TrackingEvent;
  });
}

export async function getAnalyticsSummary(
  startDate?: Date,
  endDate?: Date
): Promise<AnalyticsSummary> {
  const pageViews = await getPageViews(startDate, endDate, 10000);
  const events = await getTrackingEvents(undefined, startDate, endDate, 10000);

  // Calculate unique visitors (by session)
  const uniqueSessions = new Set(pageViews.map(pv => pv.sessionId));

  // Top pages
  const pageCounts: Record<string, number> = {};
  pageViews.forEach(pv => {
    pageCounts[pv.path] = (pageCounts[pv.path] || 0) + 1;
  });
  const topPages = Object.entries(pageCounts)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);

  // Top events
  const eventCounts: Record<string, number> = {};
  events.forEach(e => {
    eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
  });
  const topEvents = Object.entries(eventCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Views by date
  const viewsByDateMap: Record<string, number> = {};
  pageViews.forEach(pv => {
    const date = pv.timestamp.toISOString().split('T')[0];
    viewsByDateMap[date] = (viewsByDateMap[date] || 0) + 1;
  });
  const viewsByDate = Object.entries(viewsByDateMap)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Device/browser parsing (simple)
  const deviceCounts: Record<string, number> = {};
  const browserCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};

  pageViews.forEach(pv => {
    if (pv.userAgent) {
      // Simple device detection
      const isMobile = /Mobile|Android|iPhone/i.test(pv.userAgent);
      const isTablet = /iPad|Tablet/i.test(pv.userAgent);
      const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
      deviceCounts[device] = (deviceCounts[device] || 0) + 1;

      // Simple browser detection
      let browser = 'other';
      if (/Chrome/i.test(pv.userAgent)) browser = 'Chrome';
      else if (/Safari/i.test(pv.userAgent)) browser = 'Safari';
      else if (/Firefox/i.test(pv.userAgent)) browser = 'Firefox';
      else if (/Edge/i.test(pv.userAgent)) browser = 'Edge';
      browserCounts[browser] = (browserCounts[browser] || 0) + 1;
    }
  });

  const devices = Object.entries(deviceCounts).map(([device, count]) => ({ device, count }));
  const browsers = Object.entries(browserCounts).map(([browser, count]) => ({ browser, count }));
  const countries = Object.entries(countryCounts).map(([country, count]) => ({ country, count }));

  return {
    totalPageViews: pageViews.length,
    uniqueVisitors: uniqueSessions.size,
    totalEvents: events.length,
    topPages,
    topEvents,
    viewsByDate,
    devices,
    browsers,
    countries,
  };
}

// ============================================================================
// AUTO-TRACKING SETUP
// ============================================================================

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  // Track initial page view
  trackPageView();

  // Track scroll depth
  let maxScrollDepth = 0;
  const scrollThresholds = [25, 50, 75, 90];
  const trackedThresholds = new Set<number>();

  const handleScroll = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);

    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;

      // Track thresholds
      scrollThresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !trackedThresholds.has(threshold)) {
          trackedThresholds.add(threshold);
          analytics.trackScroll(threshold);
        }
      });
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  // Track clicks on important elements
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Track button clicks
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      const button = target.tagName === 'BUTTON' ? target : target.closest('button');
      const buttonText = button?.textContent?.trim() || 'unnamed';
      analytics.trackClick(`button:${buttonText}`);
    }

    // Track link clicks
    const link = target.closest('a');
    if (link) {
      const href = link.getAttribute('href') || '#';
      analytics.trackClick('link', { href });
    }
  };

  document.addEventListener('click', handleClick);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('click', handleClick);
  });
}

// Default export
export default {
  trackPageView,
  trackEvent,
  analytics,
  getPageViews,
  getTrackingEvents,
  getAnalyticsSummary,
  initAnalytics,
  getSessionId,
  getCurrentUserId,
};