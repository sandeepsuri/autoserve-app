import {
  clampLength,
  digitsOnly,
  durationSchema,
  emailSchema,
  nameSchema,
  phoneSchema,
  priceSchema,
  requiredText,
  sanitizeName,
  sanitizeText,
  urlSchema,
} from '@/lib/validation';

// ─── sanitizeText ─────────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('trims leading/trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace runs', () => {
    expect(sanitizeText('hello    world')).toBe('hello world');
  });

  it('strips angle brackets to block obvious HTML/script injection', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('scriptalert(1)/script');
  });

  it('strips control characters', () => {
    expect(sanitizeText('hello\x00\x07world')).toBe('helloworld');
  });

  it('clamps to maxLen when provided', () => {
    expect(sanitizeText('abcdefgh', 4)).toBe('abcd');
  });

  it('leaves a clean string unchanged', () => {
    expect(sanitizeText('Suri Auto & Tire')).toBe('Suri Auto & Tire');
  });
});

// ─── sanitizeName ─────────────────────────────────────────────────────────────

describe('sanitizeName', () => {
  it('strips digits', () => {
    expect(sanitizeName('John123 Doe')).toBe('John Doe');
  });

  it('strips angle brackets and disallowed special characters', () => {
    expect(sanitizeName('John<script>$$Doe')).toBe('JohnscriptDoe');
  });

  it('allows letters, spaces, apostrophes, hyphens, periods, and ampersands', () => {
    expect(sanitizeName("O'Brien-Smith & Sons Jr.")).toBe("O'Brien-Smith & Sons Jr.");
  });

  it('collapses whitespace and trims', () => {
    expect(sanitizeName('  John   Doe  ')).toBe('John Doe');
  });
});

// ─── digitsOnly ───────────────────────────────────────────────────────────────

describe('digitsOnly', () => {
  it('strips all non-digit characters', () => {
    expect(digitsOnly('(555) 123-4567')).toBe('5551234567');
  });

  it('returns an empty string when there are no digits', () => {
    expect(digitsOnly('abc')).toBe('');
  });

  it('leaves a pure digit string unchanged', () => {
    expect(digitsOnly('1234567890')).toBe('1234567890');
  });
});

// ─── clampLength ──────────────────────────────────────────────────────────────

describe('clampLength', () => {
  it('truncates a string longer than n', () => {
    expect(clampLength('abcdefgh', 3)).toBe('abc');
  });

  it('leaves a string shorter than n unchanged', () => {
    expect(clampLength('ab', 5)).toBe('ab');
  });

  it('leaves a string exactly n unchanged', () => {
    expect(clampLength('abc', 3)).toBe('abc');
  });
});

// ─── emailSchema ──────────────────────────────────────────────────────────────

describe('emailSchema', () => {
  it('accepts a valid email', () => {
    expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
  });

  it('trims surrounding whitespace', () => {
    expect(emailSchema.parse('  user@example.com  ')).toBe('user@example.com');
  });

  it('rejects an invalid email', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => emailSchema.parse('')).toThrow();
  });
});

// ─── phoneSchema ──────────────────────────────────────────────────────────────

describe('phoneSchema', () => {
  it('accepts a 10-digit number', () => {
    expect(phoneSchema.parse('5551234567')).toBe('5551234567');
  });

  it('strips formatting characters and validates digit count', () => {
    expect(phoneSchema.parse('(555) 123-4567')).toBe('5551234567');
  });

  it('rejects fewer than 10 digits', () => {
    expect(() => phoneSchema.parse('12345')).toThrow();
  });

  it('rejects more than 10 digits', () => {
    expect(() => phoneSchema.parse('123456789012')).toThrow();
  });

  it('rejects letters with no digits', () => {
    expect(() => phoneSchema.parse('abcdefghij')).toThrow();
  });
});

// ─── nameSchema ───────────────────────────────────────────────────────────────

describe('nameSchema', () => {
  it('accepts a valid name', () => {
    const schema = nameSchema('Name');
    expect(schema.parse('Jane Doe')).toBe('Jane Doe');
  });

  it('rejects a name shorter than min', () => {
    const schema = nameSchema('Name');
    expect(() => schema.parse('J')).toThrow();
  });

  it('rejects a name longer than max', () => {
    const schema = nameSchema('Name', { max: 10 });
    expect(() => schema.parse('a'.repeat(11))).toThrow();
  });

  it('rejects digits', () => {
    const schema = nameSchema('Name');
    expect(() => schema.parse('John123')).toThrow();
  });

  it('rejects angle brackets', () => {
    const schema = nameSchema('Name');
    expect(() => schema.parse('<script>')).toThrow();
  });

  it('rejects whitespace-only input', () => {
    const schema = nameSchema('Name');
    expect(() => schema.parse('   ')).toThrow();
  });
});

// ─── requiredText ─────────────────────────────────────────────────────────────

describe('requiredText', () => {
  it('accepts valid text within bounds', () => {
    const schema = requiredText('Description', { min: 5 });
    expect(schema.parse('A short bio')).toBe('A short bio');
  });

  it('rejects empty/whitespace-only input', () => {
    const schema = requiredText('Description', { min: 5 });
    expect(() => schema.parse('   ')).toThrow();
  });

  it('rejects text shorter than min', () => {
    const schema = requiredText('Description', { min: 10 });
    expect(() => schema.parse('short')).toThrow();
  });

  it('rejects text longer than max', () => {
    const schema = requiredText('Description', { max: 5 });
    expect(() => schema.parse('this is too long')).toThrow();
  });

  it('rejects angle brackets', () => {
    const schema = requiredText('Description', { min: 1 });
    expect(() => schema.parse('<img src=x>')).toThrow();
  });
});

// ─── urlSchema ────────────────────────────────────────────────────────────────

describe('urlSchema', () => {
  it('accepts a valid URL with protocol', () => {
    expect(urlSchema.parse('https://example.com')).toBe('https://example.com');
  });

  it('accepts a valid URL without protocol', () => {
    expect(urlSchema.parse('example.com')).toBe('example.com');
  });

  it('accepts an empty/undefined value since the field is optional', () => {
    expect(urlSchema.parse('')).toBe('');
    expect(urlSchema.parse(undefined)).toBeUndefined();
  });

  it('rejects an invalid URL', () => {
    expect(() => urlSchema.parse('not a url')).toThrow();
  });
});

// ─── priceSchema ──────────────────────────────────────────────────────────────

describe('priceSchema', () => {
  it('accepts a valid non-negative number', () => {
    const schema = priceSchema();
    expect(schema.parse('95')).toBe(95);
  });

  it('accepts zero', () => {
    const schema = priceSchema();
    expect(schema.parse('0')).toBe(0);
  });

  it('rejects a negative price', () => {
    const schema = priceSchema();
    expect(() => schema.parse('-5')).toThrow();
  });

  it('rejects a price above the configured max', () => {
    const schema = priceSchema({ max: 1000 });
    expect(() => schema.parse('1001')).toThrow();
  });

  it('rejects a non-numeric value', () => {
    const schema = priceSchema();
    expect(() => schema.parse('abc')).toThrow();
  });
});

// ─── durationSchema ───────────────────────────────────────────────────────────

describe('durationSchema', () => {
  it('accepts a valid positive duration', () => {
    const schema = durationSchema();
    expect(schema.parse('45')).toBe(45);
  });

  it('rejects zero', () => {
    const schema = durationSchema();
    expect(() => schema.parse('0')).toThrow();
  });

  it('rejects a negative duration', () => {
    const schema = durationSchema();
    expect(() => schema.parse('-10')).toThrow();
  });

  it('rejects a duration above the configured max', () => {
    const schema = durationSchema({ max: 120 });
    expect(() => schema.parse('121')).toThrow();
  });

  it('rejects a non-numeric value', () => {
    const schema = durationSchema();
    expect(() => schema.parse('abc')).toThrow();
  });
});
