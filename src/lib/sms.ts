/**
 * SMS/WhatsApp provider interface.
 *
 * NyumbaFlow sends OTP codes, rent reminders, arrears nudges and maintenance
 * updates by SMS. This file defines one clean interface with real
 * implementations for the two most common providers in East Africa —
 * pick one with SMS_PROVIDER in .env. Leaving it unset keeps the console
 * dev provider so the whole flow works without a real SMS account.
 */

interface SmsProvider {
  send(to: string, message: string): Promise<{ ok: boolean; id?: string; error?: string }>;
}

class ConsoleDevProvider implements SmsProvider {
  async send(to: string, message: string) {
    console.log(`[DEV SMS -> ${to}] ${message}`);
    return { ok: true, id: `dev_${Date.now()}` };
  }
}

/**
 * Africa's Talking (https://africastalking.com) — the most widely used SMS
 * gateway for Kenya/East Africa, with native short-code and sender-ID support.
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 */
class AfricasTalkingProvider implements SmsProvider {
  private apiKey = process.env.AFRICASTALKING_API_KEY || "";
  private username = process.env.AFRICASTALKING_USERNAME || "";
  private senderId = process.env.AFRICASTALKING_SENDER_ID; // optional shortcode/alphanumeric ID
  private baseUrl =
    this.username === "sandbox"
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

  async send(to: string, message: string) {
    if (!this.apiKey || !this.username) {
      return { ok: false, error: "Africa's Talking credentials not configured" };
    }
    const body = new URLSearchParams({
      username: this.username,
      to: to.startsWith("+") ? to : `+${to}`,
      message,
      ...(this.senderId ? { from: this.senderId } : {}),
    });

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        apiKey: this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.SMSMessageData?.Message || `HTTP ${res.status}` };
    }
    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.status !== "Success") {
      return { ok: false, error: recipient.status };
    }
    return { ok: true, id: recipient?.messageId };
  }
}

/**
 * Twilio (https://www.twilio.com) — works globally, including E.164 Kenyan
 * numbers, useful if you already have a Twilio account for other markets.
 * Docs: https://www.twilio.com/docs/sms/send-messages
 */
class TwilioProvider implements SmsProvider {
  private accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  private authToken = process.env.TWILIO_AUTH_TOKEN || "";
  private fromNumber = process.env.TWILIO_FROM_NUMBER || "";

  async send(to: string, message: string) {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return { ok: false, error: "Twilio credentials not configured" };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to.startsWith("+") ? to : `+${to}`,
      From: this.fromNumber,
      Body: message,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.message || `HTTP ${res.status}` };
    }
    return { ok: true, id: json.sid };
  }
}

function getProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    case "africastalking":
      return new AfricasTalkingProvider();
    case "twilio":
      return new TwilioProvider();
    default:
      return new ConsoleDevProvider();
  }
}

export async function sendSms(to: string, message: string) {
  const result = await getProvider().send(to, message);
  if (!result.ok) {
    // Never throw for SMS failures — a reminder/nudge that fails to send
    // shouldn't break the request that triggered it. Log loudly instead so
    // it's visible in server logs / your log aggregator.
    console.error(`[SMS] Failed to send to ${to}: ${result.error}`);
  }
  return result;
}
