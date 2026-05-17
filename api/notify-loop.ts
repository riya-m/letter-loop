import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

declare const process: {
  env: Record<string, string | undefined>;
};

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendKey = process.env.RESEND_API_KEY;

const allowedEvents = new Set(['phase1', 'phase2', 'phase3']);

const getEventCopy = (eventType: string) => {
  if (eventType === 'phase1') {
    return {
      subject: 'New LetterLoop started — add questions',
      title: 'A new LetterLoop is open for questions',
      body: 'Add any questions you want the group to answer.',
      path: 'submit',
    };
  }
  if (eventType === 'phase2') {
    return {
      subject: 'LetterLoop open for answers',
      title: 'Time to add your answers',
      body: 'Share your updates and respond to questions.',
      path: 'submit',
    };
  }
  return {
    subject: 'LetterLoop published — read now',
    title: 'The latest LetterLoop is published',
    body: 'Read the compiled updates and answers.',
    path: 'newsletter',
  };
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    res.status(500).json({ error: 'Server email config missing' });
    return;
  }

  const { loopId, eventType } = req.body ?? {};
  if (!loopId || typeof loopId !== 'string' || !allowedEvents.has(eventType)) {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host;
  const proto = forwardedProto || 'https';
  const origin = host ? `${proto}://${host}` : 'https://letter-loop-psi.vercel.app';
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: req.headers.authorization || '',
      },
    },
  });

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user?.email) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data: loop, error: loopError } = await supabase
      .from('loops')
      .select('id, title, admin_email')
      .eq('id', loopId)
      .single();

    if (loopError || !loop) {
      res.status(404).json({ error: 'Loop not found' });
      return;
    }

    if (loop.admin_email.toLowerCase() !== user.email.toLowerCase()) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { data: invited, error: invitedError } = await supabase
      .from('invited_emails')
      .select('email, active')
      .eq('active', true);

    if (invitedError) {
      res.status(500).json({ error: 'Failed to load invites' });
      return;
    }

    const recipients = (invited ?? [])
      .map((row) => row.email)
      .filter((email): email is string => typeof email === 'string' && email.length > 0);

    if (recipients.length === 0) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const { subject, title, body, path } = getEventCopy(eventType);
    const link = `${origin}`.replace(/\/$/, '') + `/${path}/${loopId}`;

    const resend = new Resend(resendKey);
    const results = [] as Array<{ email: string; id?: string }>;
    for (const email of recipients) {
      const response = await resend.emails.send({
        from: 'LetterLoop <onboarding@resend.dev>',
        to: email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111;">
            <h2 style="margin-bottom: 8px;">${title}</h2>
            <p style="margin: 0 0 12px;">${body}</p>
            <p style="margin: 0 0 20px;"><strong>${loop.title}</strong></p>
            <a href="${link}" style="display: inline-block; padding: 10px 16px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">Open LetterLoop</a>
          </div>
        `,
        text: `${title}\n\n${body}\n\n${loop.title}\n${link}`,
      });
      results.push({ email, id: (response as { id?: string }).id });
    }

    res.status(200).json({ ok: true, sent: results.length, results });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Email send failed' });
  }
}
