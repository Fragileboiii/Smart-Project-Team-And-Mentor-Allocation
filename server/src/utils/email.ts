import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const configured = !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;

const transporter = configured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!transporter) {
    console.log('[Email (SMTP not configured)] To: ' + to + ' | Subject: ' + subject);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to, subject, text, html,
    });
  } catch (e: any) {
    console.error('[Email error]', e.message);
  }
}