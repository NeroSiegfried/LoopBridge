/**
 * LoopBridge — Notification Service
 *
 * Handles sending OTP codes via:
 *   - Email  (nodemailer → SMTP / AWS SES)
 *   - WhatsApp (Twilio WhatsApp API)
 *   - SMS    (Twilio SMS — fallback when WhatsApp delivery fails)
 *
 * Falls back gracefully: if credentials are not configured it logs the
 * code to the console (development mode) rather than crashing.
 */
'use strict';

const nodemailer = require('nodemailer');
const config     = require('../config');

/* ─── Email transport ────────────────────────────────────────────────────── */

let emailTransport = null;

function getEmailTransport() {
    if (emailTransport) return emailTransport;
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) return null;

    emailTransport = nodemailer.createTransport({
        host:   config.smtpHost,
        port:   config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
            user: config.smtpUser,
            pass: config.smtpPass,
        },
        // AWS SES requires TLS
        tls: { rejectUnauthorized: config.nodeEnv === 'production' },
    });
    return emailTransport;
}

/* ─── Twilio client ──────────────────────────────────────────────────────── */

let twilioClient = null;

function getTwilioClient() {
    if (twilioClient) return twilioClient;
    if (!config.twilioAccountSid || !config.twilioAuthToken) return null;
    const twilio = require('twilio');
    twilioClient = twilio(config.twilioAccountSid, config.twilioAuthToken);
    return twilioClient;
}

/* ─── Templates ─────────────────────────────────────────────────────────── */

function otpEmailHtml(code) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your LoopBridge verification code</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#013352;padding:28px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-.3px;">LoopBridge</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 8px;font-size:20px;color:#013352;font-weight:700;">Verification Code</h2>
            <p style="margin:0 0 28px;font-size:15px;color:#444b54;line-height:1.6;">
              Use the code below to verify your LoopBridge account. It expires in <strong>10 minutes</strong>.
            </p>
            <!-- Code box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <div style="display:inline-block;background:#f0fdf4;border:2px solid #30c070;border-radius:10px;padding:18px 40px;font-size:36px;font-weight:700;letter-spacing:10px;color:#013352;font-family:monospace;">
                    ${code}
                  </div>
                </td>
              </tr>
            </table>
            <p style="margin:28px 0 0;font-size:13px;color:#888;line-height:1.5;">
              If you didn't request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e8ebef;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              © ${new Date().getFullYear()} LoopBridge · <a href="https://loopbridge.network" style="color:#30c070;text-decoration:none;">loopbridge.network</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function otpEmailText(code) {
    return `Your LoopBridge verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this message.`;
}

function otpWhatsAppText(code) {
    return `Your LoopBridge verification code is: *${code}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
}

function otpSmsText(code) {
    return `Your LoopBridge code: ${code} (expires in 10 min)`;
}

/* ─── Public API ─────────────────────────────────────────────────────────── */

const notificationService = {
    /**
     * Send an OTP code via email.
     * @param {string} to   – recipient email address
     * @param {string} code – 6-digit OTP
     */
    async sendOtpEmail(to, code) {
        const transport = getEmailTransport();
        if (!transport) {
            console.log(`[OTP/email] No SMTP configured — code for ${to}: ${code}`);
            return;
        }

        await transport.sendMail({
            from: `"${config.newsletterFromName}" <${config.newsletterFromEmail}>`,
            to,
            subject: `${code} is your LoopBridge verification code`,
            text:    otpEmailText(code),
            html:    otpEmailHtml(code),
        });
        console.log(`[OTP/email] Sent to ${to}`);
    },

    /**
     * Send an OTP code via WhatsApp (Twilio WhatsApp API).
     * Falls back to SMS if TWILIO_WHATSAPP_FROM is not set.
     * @param {string} to   – phone in E.164 format e.g. +2348012345678
     * @param {string} code – 6-digit OTP
     */
    async sendOtpWhatsApp(to, code) {
        const client = getTwilioClient();
        if (!client) {
            console.log(`[OTP/whatsapp] No Twilio configured — code for ${to}: ${code}`);
            return;
        }

        const from = config.twilioWhatsAppFrom; // e.g. "whatsapp:+14155238886"
        const toWA = `whatsapp:${to}`;

        await client.messages.create({
            from: from || `whatsapp:${config.twilioSmsSenderNumber}`,
            to:   toWA,
            body: otpWhatsAppText(code),
        });
        console.log(`[OTP/whatsapp] Sent to ${to}`);
    },

    /**
     * Send an OTP code via SMS (Twilio Programmable SMS).
     * @param {string} to   – phone in E.164 format
     * @param {string} code – 6-digit OTP
     */
    async sendOtpSms(to, code) {
        const client = getTwilioClient();
        if (!client) {
            console.log(`[OTP/sms] No Twilio configured — code for ${to}: ${code}`);
            return;
        }

        await client.messages.create({
            from: config.twilioSmsSenderNumber,
            to,
            body: otpSmsText(code),
        });
        console.log(`[OTP/sms] Sent to ${to}`);
    },

    /** True when real email delivery is configured */
    get emailConfigured() { return !!(config.smtpHost && config.smtpUser && config.smtpPass); },

    /** True when real WhatsApp/SMS delivery is configured */
    get twilioConfigured() { return !!(config.twilioAccountSid && config.twilioAuthToken); },
};

module.exports = notificationService;
