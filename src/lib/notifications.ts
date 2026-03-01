import { supabase } from '@/integrations/supabase/client';

// OneSignal helper: get the OneSignal SDK instance
function getOneSignal(): any {
  return (window as any).OneSignal;
}

/** Check if OneSignal is loaded and initialized */
export function isOneSignalReady(): boolean {
  const os = getOneSignal();
  return !!os;
}

/** Login user to OneSignal (set external_id) */
export async function oneSignalLogin(userId: string) {
  const os = getOneSignal();
  if (!os) {
    console.warn('[OneSignal] SDK not loaded');
    return;
  }
  try {
    await os.login(userId);
    console.log('[OneSignal] User logged in:', userId);
  } catch (e: any) {
    console.error('[OneSignal] Login error:', e.message);
  }
}

/** Logout user from OneSignal */
export async function oneSignalLogout() {
  const os = getOneSignal();
  if (!os) return;
  try {
    await os.logout();
    console.log('[OneSignal] User logged out');
  } catch (e: any) {
    console.error('[OneSignal] Logout error:', e.message);
  }
}

/** Prompt user for notification permission via OneSignal */
export async function requestOneSignalPermission(): Promise<boolean> {
  const os = getOneSignal();
  if (!os) return false;
  try {
    const permission = await os.Notifications.requestPermission();
    console.log('[OneSignal] Permission result:', permission);
    return permission;
  } catch (e: any) {
    console.error('[OneSignal] Permission error:', e.message);
    return false;
  }
}

/** Get OneSignal subscription status */
export function getOneSignalStatus(): { permission: string; subscribed: boolean; userId: string | null } {
  const os = getOneSignal();
  if (!os) return { permission: 'unknown', subscribed: false, userId: null };
  try {
    const permission = os.Notifications?.permission ? 'granted' : (os.Notifications?.permissionNative || 'default');
    const subscribed = os.User?.PushSubscription?.optedIn || false;
    const userId = os.User?.externalId || null;
    return { permission, subscribed, userId };
  } catch {
    return { permission: 'unknown', subscribed: false, userId: null };
  }
}

// Keep these for backward compat with notification preferences
export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching preferences:', error);
  }

  return data;
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    prayer_reminders?: boolean;
    ramadan_activities?: boolean;
    daily_reminder_time?: string;
    fajr_reminder?: boolean;
    dhuhr_reminder?: boolean;
    asr_reminder?: boolean;
    maghrib_reminder?: boolean;
    isha_reminder?: boolean;
  }
) {
  const { error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      ...preferences,
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    console.error('Error updating preferences:', error);
    return false;
  }

  return true;
}
