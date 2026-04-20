const axios = require('axios');
const { formatPhoneForSms } = require('./validators');

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);

const isEmailDeliveryConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);

const isSmsDeliveryConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );

const getVerificationContent = ({ code, purpose }) => {
  const actionText = purpose === 'signup' ? 'signup' : 'password reset';
  const subject = `Your verification code for ${actionText}`;
  const text = `Your Image Generator ${actionText} code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`;
  const html = `<p>Your Image Generator ${actionText} code is <strong>${code}</strong>.</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`;

  return {
    subject,
    text,
    html,
  };
};

const sendEmailWithResend = async ({ to, subject, text, html }) => {
  await axios.post(
    'https://api.resend.com/emails',
    {
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      text,
      html,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
};

const sendSmsWithTwilio = async ({ to, text }) => {
  const params = new URLSearchParams();
  params.append('To', formatPhoneForSms(to));
  params.append('From', process.env.TWILIO_PHONE_NUMBER);
  params.append('Body', text);

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
    params.toString(),
    {
      auth: {
        username: process.env.TWILIO_ACCOUNT_SID,
        password: process.env.TWILIO_AUTH_TOKEN,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    }
  );
};

const throwDeliveryError = (message, error) => {
  console.error(message, error.response?.data || error.message);
  const deliveryError = new Error(message);
  deliveryError.status = 502;
  throw deliveryError;
};

const buildUnconfiguredDeliveryError = (contactType) => {
  const error =
    contactType === 'email'
      ? new Error(
          'Email verification is not configured on this server. Add RESEND_API_KEY and RESEND_FROM_EMAIL in backend/.env.'
        )
      : new Error(
          'SMS verification is not configured on this server. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and optionally SMS_DEFAULT_COUNTRY_CODE in backend/.env. Users can also enter a full international number such as +919876543210.'
        );

  error.status = 503;
  return error;
};

const sendVerificationCode = async ({ contact, code, purpose }) => {
  const content = getVerificationContent({ code, purpose });

  if (contact.type === 'email') {
    if (isEmailDeliveryConfigured()) {
      try {
        await sendEmailWithResend({
          to: contact.value,
          subject: content.subject,
          text: content.text,
          html: content.html,
        });
        return { delivered: true, provider: 'resend', mode: 'live' };
      } catch (error) {
        if (error.status && !error.response) {
          throw error;
        }
        throwDeliveryError('Could not send verification code by email.', error);
      }
    }
  }

  if (contact.type === 'phone') {
    if (isSmsDeliveryConfigured()) {
      try {
        await sendSmsWithTwilio({
          to: contact.value,
          text: content.text,
        });
        return { delivered: true, provider: 'twilio', mode: 'live' };
      } catch (error) {
        if (error.status && !error.response) {
          throw error;
        }
        throwDeliveryError('Could not send verification code by SMS.', error);
      }
    }
  }

  // Debug/fallback: show code in console and return it to frontend
  console.info(`[OTP:${purpose}] ${contact.type} ${contact.value} -> ${code}`);

  return {
    delivered: false,
    provider: 'console',
    debugCode: code,
    mode: 'debug',
  };
};

module.exports = {
  sendVerificationCode,
};
