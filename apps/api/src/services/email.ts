import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = 'AI Release Toolkit <noreply@epkpage.com>';

export interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const from = opts.fromName
    ? `${opts.fromName} <${opts.fromEmail ?? 'noreply@epkpage.com'}>`
    : FROM_ADDRESS;

  await resend.emails.send({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.body,
  });
}

export async function sendVerificationEmail(
  to: string,
  name: string,
  token: string
): Promise<void> {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify?token=${token}`;

  const body = `Hi ${name},

Welcome to AI Release Toolkit! Please verify your email address by clicking the link below:

${verifyUrl}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

— AI Release Toolkit`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Verify your email — AI Release Toolkit',
    text: body,
  });
}
