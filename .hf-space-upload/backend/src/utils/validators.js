const jwt = require('jsonwebtoken');
const validator = require('validator');

const PHONE_REGEX = /^\d{10,15}$/;

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();

const normalizePhone = (phone = '') => String(phone || '').trim().replace(/[^\d]/g, '');

const validateEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail) && validator.isEmail(normalizedEmail);
};

const validatePhone = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  return PHONE_REGEX.test(normalizedPhone);
};

const getSmsDefaultCountryCode = () =>
  String(process.env.SMS_DEFAULT_COUNTRY_CODE || '')
    .trim()
    .replace(/[^\d]/g, '');

const getContactFromIdentifier = (identifier) => {
  const rawIdentifier = String(identifier || '').trim();

  if (!rawIdentifier) {
    return null;
  }

  const normalizedEmail = normalizeEmail(rawIdentifier);
  if (validateEmail(normalizedEmail)) {
    return {
      type: 'email',
      value: normalizedEmail,
      label: normalizedEmail,
    };
  }

  const normalizedPhone = normalizePhone(rawIdentifier);
  if (validatePhone(normalizedPhone)) {
    return {
      type: 'phone',
      value: normalizedPhone,
      label: normalizedPhone,
    };
  }

  return null;
};

const buildContactFields = (contact) => ({
  email: contact?.type === 'email' ? contact.value : undefined,
  phone: contact?.type === 'phone' ? contact.value : undefined,
});

const formatPhoneForSms = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return '';
  }

  const defaultCountryCode = getSmsDefaultCountryCode();

  if (normalizedPhone.length === 10) {
    if (!defaultCountryCode) {
      const error = new Error(
        'For SMS delivery, enter the mobile number with country code (for example, +919876543210) or configure SMS_DEFAULT_COUNTRY_CODE on the server.'
      );
      error.status = 400;
      throw error;
    }

    return `+${defaultCountryCode}${normalizedPhone}`;
  }

  return `+${normalizedPhone}`;
};

const validatePassword = (password) => {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return re.test(password);
};

const getPasswordStrength = (password) => {
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[@$!%*?&]/.test(password)) strength++;

  if (strength <= 2) return 'Weak';
  if (strength <= 4) return 'Fair';
  if (strength <= 5) return 'Good';
  return 'Strong';
};

module.exports = {
  buildContactFields,
  formatPhoneForSms,
  generateToken,
  getContactFromIdentifier,
  getPasswordStrength,
  getSmsDefaultCountryCode,
  normalizeEmail,
  normalizePhone,
  validateEmail,
  validatePassword,
  validatePhone,
};
