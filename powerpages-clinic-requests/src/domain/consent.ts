/**
 * POPIA consent wording. The version is saved with every request so the
 * clinic can prove exactly which wording a person agreed to. Change the
 * version whenever the wording changes.
 */
export const CONSENT_VERSION = 'popia-2026-10-v1';

export const CONSENT_TEXT =
  'I agree that Contoso Clinic may use the details in this form, including the reason for my visit, ' +
  'to arrange my appointment and contact me about it. My information is kept securely, is not used ' +
  'for marketing, and I can ask to see, correct or delete it at any time.';

export const PRIVACY_POINTS: readonly string[] = [
  'We only use these details to arrange this appointment and to contact you about it.',
  'The reason for your visit can be health information, which POPIA treats as special personal information. Only the staff who book appointments can see it.',
  'We keep appointment requests for 12 months and then delete them.',
  'To see, correct or delete your information, email privacy@contoso-clinic.example or call 021 555 0100.',
];
