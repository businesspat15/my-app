// api/register.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase server envs (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
}
if (!BOT_TOKEN) {
  console.warn('BOT_TOKEN missing: Telegram initData verification will be skipped if absent.');
}

const serverClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// verifies telegram initData string according to Telegram docs (sha256 HMAC)
function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    if (!hash) return false;

    const entries: string[] = [];
    for (const [k, v] of params.entries()) {
      if (k === 'hash') continue;
      entries.push(`${k}=${v}`);
    }
    entries.sort();
    const dataCheckString = entries.join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
  } catch (err) {
    console.warn('verifyInitData failed', err);
    return false;
  }
}

async function notifyReferrer(referrerId: string, message: string) {
  if (!BOT_TOKEN) return;
  try {
    const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: referrerId, text: message })
    });
    return resp.ok;
  } catch (e) {
    console.warn('notifyReferrer failed', e);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id, username, referredBy, initData, languageCode } = req.body || {};

  if (!id || !username) return res.status(400).json({ error: 'Missing id or username' });

  // Verify initData if provided and BOT_TOKEN present
  if (initData && BOT_TOKEN) {
    const ok = verifyInitData(initData, BOT_TOKEN);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid Telegram initData' });
    }
  }

  try {
    // Normalize referral: ensure "ref_<id>" or just id -> pass to RPC as provided (RPC strips 'ref_' prefix)
    const refValue = referredBy ?? null;

    // Call RPC handle_referral
    const { data, error } = await serverClient.rpc('handle_referral', {
      p_new_user_id: id,
      p_new_username: username,
      p_referred_by: refValue
    });

    if (error) {
      console.error('RPC handle_referral error', error);
      return res.status(500).json({ error: error.message || error });
    }

    // Optionally notify the referrer (only if referredBy present and numeric-ish)
    if (referredBy) {
      // strip prefix ref_ if exists for chat id
      const refId = String(referredBy).replace(/^ref_/, '');
      try {
        await notifyReferrer(refId, `🎉 You earned a referral bonus! (+100 coins)`);
      } catch (e) {
        console.warn('notifyReferrer error', e);
      }
    }

    return res.status(200).json({ ok: true, result: data });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: String(err) });
  }
}
