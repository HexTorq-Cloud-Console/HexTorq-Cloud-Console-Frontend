'use client';

import { useEffect } from 'react';
import { registerPushWorker } from '../lib/push';

/**
 * Registers the notification service worker as soon as the app boots.
 *
 * The worker must be registered at the root scope so it can receive push
 * events for every console route, and it must exist before the user opts in
 * on the Alerts page.
 */
export default function PushRegistration() {
  useEffect(() => {
    void registerPushWorker();
  }, []);

  return null;
}
