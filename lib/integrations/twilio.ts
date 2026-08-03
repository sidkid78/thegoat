import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Sends an SMS text alert for scheduled home viewings
 */
export async function sendViewingConfirmationSMS(toPhone: string, propertyAddress: string, scheduledAt: string) {
  if (!client || !fromPhone) {
    console.warn('Twilio credentials not configured. Skipping SMS alert.');
    return { success: true, simulated: true };
  }

  try {
    const message = await client.messages.create({
      body: `[Dwellingly.ai] Your home tour request for ${propertyAddress} on ${new Date(scheduledAt).toLocaleString()} has been confirmed!`,
      from: fromPhone,
      to: toPhone,
    });

    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error('Twilio SMS sending error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends an SMS text alert for offer updates
 */
export async function sendOfferStatusSMS(toPhone: string, propertyAddress: string, status: string, offerAmount: number) {
  if (!client || !fromPhone) {
    console.warn('Twilio credentials not configured. Skipping SMS alert.');
    return { success: true, simulated: true };
  }

  try {
    const message = await client.messages.create({
      body: `[Dwellingly.ai] Update on your $${offerAmount.toLocaleString()} offer for ${propertyAddress}: Status is now '${status.toUpperCase()}'. Check your dashboard for details.`,
      from: fromPhone,
      to: toPhone,
    });

    return { success: true, sid: message.sid };
  } catch (err: any) {
    console.error('Twilio SMS sending error:', err.message);
    return { success: false, error: err.message };
  }
}