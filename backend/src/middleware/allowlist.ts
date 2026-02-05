/**
 * Allowlist validation for user access control
 * Supports both email domain allowlisting and individual email allowlisting
 */

const ALLOWED_EMAIL_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS
  ? process.env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase())
  : [];

const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase())
  : [];

/**
 * Check if user email is allowed
 * Returns true if email matches domain allowlist or email allowlist
 */
export function isEmailAllowed(email: string): boolean {
  const lowerEmail = email.toLowerCase();

  // Check explicit email allowlist
  if (ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS.includes(lowerEmail)) {
    return true;
  }

  // Check domain allowlist
  if (ALLOWED_EMAIL_DOMAINS.length > 0) {
    const domain = lowerEmail.split('@')[1];
    if (domain && ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      return true;
    }
  }

  // If neither list is configured, allow all (dev mode)
  if (ALLOWED_EMAIL_DOMAINS.length === 0 && ALLOWED_EMAILS.length === 0) {
    console.warn('[Security] No email allowlists configured. All users will be allowed.');
    return true;
  }

  return false;
}

/**
 * Get configured allowlists for debugging
 */
export function getAllowlistConfig() {
  return {
    allowedDomains: ALLOWED_EMAIL_DOMAINS,
    allowedEmails: ALLOWED_EMAILS,
    isConfigured: ALLOWED_EMAIL_DOMAINS.length > 0 || ALLOWED_EMAILS.length > 0,
  };
}
