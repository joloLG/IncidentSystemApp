import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, name, reason } = body as {
      to: string;
      name?: string;
      reason: string;
    };

    if (!to || !reason) {
      return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
    }

    const SMTP_HOST = process.env.SMTP_HOST;
    const SMTP_PORT = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
    const SMTP_USER = process.env.SMTP_USER;
    const SMTP_PASS = process.env.SMTP_PASS;
    const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@mdrrmo.local';

    const subject = 'Account Ban Lifted';
    const lines: string[] = [];
    lines.push(`Hello ${name || ''}`.trim());
    lines.push('');
    lines.push('The ban on your account has been lifted by the MDRRMO administrators.');
    lines.push('');
    lines.push('Reason/Message from admin:');
    lines.push(reason);
    lines.push('');
    lines.push('You may now log in and use the application. If you have any questions, please reply to this email.');
    const text = lines.filter(Boolean).join('\n');

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
      console.warn('[send-unban-email] SMTP not configured. Skipping actual email send.');
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
    console.error('[send-unban-email] error', e);
    return NextResponse.json({ ok: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
