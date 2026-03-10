'use client';

import { useEffect } from 'react';

/**
 * SlotSyncProvider - Automatically unlocks expired slots on page load
 * This provider calls the unlock-expired-slots API whenever the app initializes
 * to ensure slots locked for 10+ minutes are returned to the market
 */
export function SlotSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unlockExpiredSlots = async () => {
      try {
        const response = await fetch('/api/booking/unlock-expired-slots', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.unlockedCount > 0) {
            console.log(`🔓 [SlotSync] ${data.unlockedCount} expired slots unlocked`);
          }
        } else {
          console.warn('⚠️ [SlotSync] Failed to unlock expired slots');
        }
      } catch (error) {
        console.error('❌ [SlotSync] Error unlocking expired slots:', error);
      }
    };

    // Call on mount
    unlockExpiredSlots();

    // Also call every 5 minutes to catch expired slots periodically
    const interval = setInterval(unlockExpiredSlots, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
