import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  type: 'all' | 'prayer' | 'ramadan' | 'admin' | 'user';
  userId?: string;
}

// ── Crypto helpers for Web Push (RFC 8030 + VAPID) ───────────────

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  // Step 1: Extract - HMAC-SHA-256(salt, ikm)
  const saltKey = await crypto.subtle.importKey(
    'raw',
    salt.length > 0 ? salt : new Uint8Array(32),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const prk = new Uint8Array(await crypto.subtle.sign('HMAC', saltKey, ikm));

  // Step 2: Expand - HMAC-SHA-256(prk, info || 0x01)
  const prkKey = await crypto.subtle.importKey(
    'raw',
    prk,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const t = new Uint8Array([...info, 1]);
  const okm = new Uint8Array(await crypto.subtle.sign('HMAC', prkKey, t));
  return okm.slice(0, length);
}

function buildInfo(type: string, clientPublic: Uint8Array, serverPublic: Uint8Array): Uint8Array {
  const encoder = new TextEncoder();
  const label = encoder.encode(`Content-Encoding: ${type}\0`);
  const result = new Uint8Array(label.length + 1 + 2 + clientPublic.length + 2 + serverPublic.length);
  let offset = 0;
  result.set(label, offset); offset += label.length;
  result[offset++] = 0;
  result[offset++] = 0; result[offset++] = clientPublic.length;
  result.set(clientPublic, offset); offset += clientPublic.length;
  result[offset++] = 0; result[offset++] = serverPublic.length;
  result.set(serverPublic, offset);
  return result;
}

async function encryptPayload(
  clientPublicKey: Uint8Array,
  clientAuth: Uint8Array,
  payload: string
): Promise<{ encrypted: Uint8Array; serverPublicKey: Uint8Array; salt: Uint8Array }> {
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey)
  );

  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: clientKey },
      serverKeys.privateKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  const authInfo = encoder.encode('Content-Encoding: auth\0');
  const ikm = await hkdf(clientAuth, sharedSecret, authInfo, 32);

  const contentEncKeyInfo = buildInfo('aesgcm', clientPublicKey, serverPublicKey);
  const contentEncKey = await hkdf(salt, ikm, contentEncKeyInfo, 16);

  const nonceInfo = buildInfo('nonce', clientPublicKey, serverPublicKey);
  const nonce = await hkdf(salt, ikm, nonceInfo, 12);

  const paddingLength = 2;
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(paddingLength + payloadBytes.length);
  paddedPayload[0] = 0;
  paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, paddingLength);

  const aesKey = await crypto.subtle.importKey(
    'raw',
    contentEncKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  return { encrypted, serverPublicKey, salt };
}

// Create VAPID Authorization header using JWK import (reliable across runtimes)
async function createVapidAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const audience = new URL(endpoint).origin;

  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    aud: audience,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(jwtPayload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Decode the raw 32-byte private key and 65-byte public key
  const rawPrivateKey = base64UrlDecode(vapidPrivateKey);
  const rawPublicKey = base64UrlDecode(vapidPublicKey);

  // Extract X and Y coordinates from the uncompressed public key (04 || X || Y)
  const x = base64UrlEncode(rawPublicKey.slice(1, 33));
  const y = base64UrlEncode(rawPublicKey.slice(33, 65));
  const d = base64UrlEncode(rawPrivateKey);

  // Import as JWK - this is the most reliable method across Deno runtimes
  const cryptoKeyObj = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x,
      y,
      d,
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKeyObj,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s format (64 bytes)
  const derSig = new Uint8Array(signatureBuffer);
  let rawSig: Uint8Array;
  if (derSig[0] === 0x30) {
    let offset = 2;
    const rLen = derSig[offset + 1];
    const r = derSig.slice(offset + 2, offset + 2 + rLen);
    offset += 2 + rLen;
    const sLen = derSig[offset + 1];
    const s = derSig.slice(offset + 2, offset + 2 + sLen);

    const rPad = new Uint8Array(32);
    const sPad = new Uint8Array(32);
    rPad.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    sPad.set(s.length > 32 ? s.slice(s.length - 32) : s, 32 - Math.min(s.length, 32));

    rawSig = new Uint8Array(64);
    rawSig.set(rPad, 0);
    rawSig.set(sPad, 32);
  } else {
    rawSig = derSig;
  }

  const signatureB64 = base64UrlEncode(rawSig);
  const jwt = `${unsignedToken}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    cryptoKey: vapidPublicKey,
  };
}

// Send a single push notification
async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  supabase: any
): Promise<{ ok: boolean; status: number; gone: boolean; responseBody: string }> {
  try {
    const clientPublicKey = base64UrlDecode(p256dh);
    const clientAuth = base64UrlDecode(auth);
    const payloadStr = JSON.stringify(payload);

    const { encrypted, serverPublicKey, salt } = await encryptPayload(
      clientPublicKey,
      clientAuth,
      payloadStr
    );

    const vapidAuth = await createVapidAuth(
      endpoint,
      vapidPublicKey,
      vapidPrivateKey,
      'mailto:admin@dini-bismillah.app'
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Authorization': vapidAuth.authorization,
        'Crypto-Key': `dh=${base64UrlEncode(serverPublicKey)};p256ecdsa=${vapidAuth.cryptoKey}`,
        'Encryption': `salt=${base64UrlEncode(salt)}`,
        'TTL': '86400',
        'Urgency': 'high',
      },
      body: encrypted,
    });

    const responseBody = await response.text();
    const gone = response.status === 404 || response.status === 410;
    // Apple returns 201 on success, FCM returns 201 or 200
    const ok = response.status === 200 || response.status === 201;

    // Log each attempt to app_logs
    try {
      await supabase.from('app_logs').insert({
        level: ok ? 'info' : 'error',
        message: `Push ${ok ? 'OK' : 'FAIL'} → ${endpoint.substring(0, 50)}`,
        context: JSON.stringify({
          status: response.status,
          responseBody: responseBody.substring(0, 500),
          endpoint: endpoint.substring(0, 20),
          gone,
        }),
      });
    } catch (_) { /* best effort */ }

    return { ok, status: response.status, gone, responseBody };
  } catch (error: any) {
    console.error('sendPush error:', error);
    // Log the error
    try {
      await supabase.from('app_logs').insert({
        level: 'error',
        message: `sendPush exception: ${error.message}`,
        context: JSON.stringify({ endpoint: endpoint.substring(0, 20), stack: error.stack?.substring(0, 300) }),
      });
    } catch (_) { /* best effort */ }
    return { ok: false, status: 0, gone: false, responseBody: error.message };
  }
}

// ── Main handler ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: NotificationPayload = await req.json();
    const { title, body: notifBody, url, type, userId } = body;

    if (!title || !notifBody) {
      return new Response(
        JSON.stringify({ error: 'Title and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch target subscriptions
    const query = supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id');
    const { data: allSubs, error: subError } = await query;
    if (subError) throw subError;

    let targetSubs = allSubs || [];

    if (type === 'admin') {
      const { data: adminRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      const adminIds = (adminRoles || []).map((r: any) => r.user_id);
      targetSubs = targetSubs.filter((s: any) => adminIds.includes(s.user_id));
    } else if (type === 'user' && userId) {
      targetSubs = targetSubs.filter((s: any) => s.user_id === userId);
    } else if (type === 'prayer' || type === 'ramadan') {
      const { data: prefs } = await supabase.from('notification_preferences').select('user_id, prayer_reminders, ramadan_activities');
      const enabledIds = (prefs || [])
        .filter((p: any) => type === 'prayer' ? p.prayer_reminders : p.ramadan_activities)
        .map((p: any) => p.user_id);
      targetSubs = targetSubs.filter((s: any) => enabledIds.includes(s.user_id));
    }

    // Build push payload with full notification options (iOS Safari compatible)
    const pushPayload = {
      title,
      body: notifBody,
      url: url || '/',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'dini-bismillah',
      renotify: true,
    };

    let sentCount = 0;
    const expiredIds: string[] = [];
    const errors: string[] = [];

    for (const sub of targetSubs) {
      const result = await sendPush(
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        pushPayload,
        vapidPublicKey,
        vapidPrivateKey,
        supabase
      );

      if (result.ok) {
        sentCount++;
      } else if (result.gone) {
        expiredIds.push(sub.id);
      } else {
        errors.push(`${sub.endpoint.substring(0, 30)}: ${result.status} - ${result.responseBody.substring(0, 100)}`);
      }
      console.log(`Push to ${sub.endpoint.slice(0, 60)}... → ${result.status}`);
    }

    // Cleanup expired subscriptions
    if (expiredIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expiredIds);
      console.log(`Cleaned up ${expiredIds.length} expired subscriptions`);
    }

    console.log(`Sent ${sentCount}/${targetSubs.length} notifications, ${expiredIds.length} expired`);

    const firstEndpoint = targetSubs.length > 0 ? targetSubs[0].endpoint : '';

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        total: targetSubs.length,
        expired: expiredIds.length,
        debug_endpoint: firstEndpoint,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
