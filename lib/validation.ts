import { z } from 'zod';

// ---------------------------------------------------------------------------
// Sanitizers — pure string functions, safe to call on every keystroke.
// ---------------------------------------------------------------------------

/**
 * Strips control characters and angle brackets (blocks obvious HTML/script
 * injection), collapses internal whitespace runs, and trims. Optionally
 * clamps to a max length.
 */
export function sanitizeText(value: string, maxLen?: number): string {
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return typeof maxLen === 'number' ? clampLength(cleaned, maxLen) : cleaned;
}

/**
 * Sanitizes a human name field: applies `sanitizeText`, strips digits, and
 * only allows letters, spaces, and the common name punctuation `'-.&`.
 */
export function sanitizeName(value: string): string {
  return sanitizeText(value)
    .replace(/[0-9]/g, '')
    .replace(/[^A-Za-z\s'\-.&]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strips every non-digit character (for phone numbers). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Clamps a string to at most `n` characters. */
export function clampLength(value: string, n: number): string {
  return value.length > n ? value.slice(0, n) : value;
}

// ---------------------------------------------------------------------------
// Zod schemas / builders
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => digitsOnly(value))
  .refine((value) => value.length === 10, {
    message: 'Enter a valid 10-digit phone number',
  });

export const guestBookingContactSchema = z.object({
  name: nameSchema('Full name'),
  email: emailSchema,
  phone: phoneSchema,
});

export const guestVehicleSchema = z.object({
  make: requiredText('Make', { max: 60 }),
  model: requiredText('Model', { max: 60 }),
  year: z
    .string()
    .trim()
    .regex(/^\d{4}$/, 'Enter a valid 4-digit year')
    .refine((value) => {
      const year = Number(value);
      return year >= 1900 && year <= new Date().getFullYear() + 2;
    }, 'Enter a valid vehicle year'),
  trim: z.string().trim().max(60, 'Trim must be 60 characters or fewer').optional(),
  color: z.string().trim().max(30, 'Colour must be 30 characters or fewer').optional(),
  plate: z.string().trim().max(12, 'License plate must be 12 characters or fewer').optional(),
});

export function nameSchema(label: string, { min = 2, max = 60 }: { min?: number; max?: number } = {}) {
  return z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((value) => !/[<>]/.test(value), { message: `${label} contains invalid characters` })
    .refine((value) => !/\d/.test(value), { message: `${label} cannot contain numbers` })
    .refine((value) => value.trim().length > 0, { message: `${label} is required` });
}

export function requiredText(label: string, { min = 1, max = 500 }: { min?: number; max?: number } = {}) {
  return z
    .string()
    .trim()
    .min(min, min > 1 ? `${label} must be at least ${min} characters` : `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
    .refine((value) => !/[<>]/.test(value), { message: `${label} contains invalid characters` });
}

const URL_PATTERN = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/;

export const urlSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || value.length === 0 || URL_PATTERN.test(value), {
    message: 'Enter a valid URL',
  });

export function priceSchema({ max = 100000 }: { max?: number } = {}) {
  return z.coerce
    .number({ message: 'Enter a valid price' })
    .refine((value) => Number.isFinite(value), { message: 'Enter a valid price' })
    .refine((value) => value >= 0, { message: 'Price cannot be negative' })
    .refine((value) => value <= max, { message: `Price must be ${max} or less` });
}

export function durationSchema({ max = 1440 }: { max?: number } = {}) {
  return z.coerce
    .number({ message: 'Enter a valid duration' })
    .refine((value) => Number.isFinite(value), { message: 'Enter a valid duration' })
    .refine((value) => value > 0, { message: 'Duration must be greater than 0' })
    .refine((value) => value <= max, { message: `Duration must be ${max} minutes or less` });
}
