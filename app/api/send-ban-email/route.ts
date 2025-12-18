import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, name, reason, until, permanent } = body as {
      to: string;
      name?: string;
      reason: string;
      until?: string | null;
      permanent?: boolean;
    };

    if (!to || !reason) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@mdrrmo.local';

    const subject = permanent
      ? 'Account Banned (Permanent)'
      : until
        ? `Account Banned Until ${new Date(until).toLocaleString()}`
        : 'Account Banned';
    const lines: string[] = [];
    lines.push(`Hello ${name || ''}`.trim());
    lines.push('');
    lines.push('Your account has been banned by the MDRRMO administrators.');
    lines.push(permanent ? 'This is a permanent ban.' : until ? `Ban duration: until ${new Date(until).toLocaleString()}` : '');
    lines.push('');
    lines.push('Reason:');
    lines.push(reason);
    lines.push('');
    lines.push('If you believe this was a mistake or need further information, please reply to this email.');
    const text = lines.filter(Boolean).join('\n');
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.warn('[send-ban-email] SMTP not configured. Skipping actual email send.');
      return NextResponse.json({ ok: true, skipped: true });
    }
    const nodemailer: any = await import('nodemailer').catch(() => null);
      if (!nodemailer?.default && !nodemailer?.createTransport) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const transporter = (nodemailer.default || nodemailer).createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[send-ban-email] error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
