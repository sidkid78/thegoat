import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Twilio requires E.164 (`+15125550192`). Profile phones are stored however the
 * user typed them -- the seed rows are `512-555-0192` -- so normalise before
 * sending rather than letting Twilio reject the whole request.
 *
 * Returns null when the input can't be made into a plausible number, which the
 * callers treat as "no phone on file" rather than an error: a missing number
 * should never fail the transaction that triggered the alert.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Already E.164.
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) return trimmed;

  const digits = trimmed.replace(/\D/g, '');
  // Bare 10-digit US/Canada number.
  if (digits.length === 10) return `+1${digits}`;
  // 11 digits starting with the US country code.
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  return null;
}

/**
 * Sends `body` to `toPhone`, swallowing every failure into a returned result.
 *
 * Notification delivery must never break the action that triggered it -- an
 * accepted offer stays accepted whether or not the SMS goes out, the same way
 * a DocuSign failure doesn't roll back an acceptance.
 */
export async function sendSms(
  toPhone: string | null | undefined,
  body: string
): Promise<{ success: boolean; simulated?: boolean; sid?: string; error?: string }> {
  const to = toE164(toPhone);
  if (!to) return { success: false, error: 'No usable phone number on file' };

  if (!client || !fromPhone) {
    console.warn('Twilio credentials not configured. Skipping SMS alert.');
    return { success: true, simulated: true };
  }

  try {
    const message = await client.messages.create({ body, from: fromPhone, to });
    return { success: true, sid: message.sid };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error('Twilio SMS sending error:', error);
    return { success: false, error };
  }
}

/**
 * Confirms a scheduled home tour to the person who booked it.
 */
export async function sendViewingConfirmationSMS(
  toPhone: string | null | undefined,
  propertyAddress: string,
  scheduledAt: string
) {
  return sendSms(
    toPhone,
    `[Dwellingly] Your home tour for ${propertyAddress} on ${new Date(scheduledAt).toLocaleString()} is confirmed.`
  );
}

/**
 * Tells a buyer their offer moved -- accepted, rejected or countered.
 */
export async function sendOfferStatusSMS(
  toPhone: string | null | undefined,
  propertyAddress: string,
  status: string,
  offerAmount: number
) {
  return sendSms(
    toPhone,
    `[Dwellingly] Your $${offerAmount.toLocaleString()} offer on ${propertyAddress} is now ${status.toUpperCase()}. Open your dashboard for details.`
  );
}

/**
 * Tells a seller a new offer landed on one of their listings.
 */
export async function sendNewOfferSMS(
  toPhone: string | null | undefined,
  propertyAddress: string,
  offerAmount: number
) {
  return sendSms(
    toPhone,
    `[Dwellingly] New offer of $${offerAmount.toLocaleString()} received on ${propertyAddress}. Review it in your offers inbox.`
  );
}
