// api/register.ts (Vercel serverless)
// npm packages needed: @supabase/supabase-js (already installed)
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// envs (server-only)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BOT_TOKEN = process.env.BOT_TOKEN!; // Telegram bot token

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing supabase server envs');
}
if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN');
}

const serverClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/** Verify Telegram initData string against bot token */
function verifyInitData(initData: string, botToken: string): boolean {
  // Parse query-string style string into entries
  // e.g. "user={...}&auth_date=...&hash=..."
  const params = new URLSearchParams(initData);
  const hash = params.get('hash') || '';
  if (!hash) return false;

  // Build data_check_string: all other keys sorted alphabetically as key=value, joined by '\n'
  const entries: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    // For object-like values (JSON) we keep the raw value string
    entries.push(`${k}=${v}`);
  }
  entries.sort(); // alphabetical
  const dataCheckString = entries.join('\n');

  // Secret key: SHA256(bot_token) (binary)
  const secretKey = crypto.createHash('sha256').update(botToken).digest();

  // HMAC-SHA256 of dataCheckString using secretKey
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Compare (timing-safe)
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(hash, 'hex'));
}

/** Optional: notify referrer via bot */
async function notifyReferrer(referrerId: string, message: string) {
  try {
    const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await fetch(botUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: referrerId,
        text: message
      })
    });
  } catch (err) {
    console.warn('notifyReferrer failed', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const body = req.body || {};

  const { initData, id, username, referredBy, languageCode } = body;
  if (!id || !username) return res.status(400).json({ error: 'Missing id or username' });

  // 1) Optional initData verification (recommended)
  if (initData) {
    const ok = verifyInitData(initData, BOT_TOKEN);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid initData (failed signature)' });
    }
  }

  try {
    // 2) Call Supabase RPC function handle_referral to create user and credit referrer atomically
    const rpcArgs = {
      p_new_user_id: id,
      p_new_username: username,
      p_referred_by: referredBy || null
    };

    const { data, error } = await serverClient.rpc('handle_referral', rpcArgs);

    if (error) {
      console.error('RPC error', error);
      return res.status(500).json({ error: error.message || error });
    }

    // 3) Optionally notify the referrer that they earned a bonus
    if (referredBy) {
      // expected format: "ref_<referrerId>"
      const ref = referredBy.replace(/^ref_/, '');
      try {
        await notifyReferrer(ref, `🎉 You just got a referral! +100 coins (from ${username}).`);
      } catch (e) {
        console.warn('notifyReferrer error', e);
      }
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ error: String(err) });
  }
}
