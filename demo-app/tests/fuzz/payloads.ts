import fc from 'fast-check';

/** Known-nasty strings. fast-check mixes these with random strings so both known and unknown cases are tried. */
const NASTY_STRINGS = [
  '',
  ' ',
  "'",
  '"',
  "' OR '1'='1",
  "'; DROP TABLE products;--",
  "%' UNION SELECT id,email,password,role FROM users--",
  '%',
  '_',
  '\\',
  '\u0000',
  '\r\n',
  '../../etc/passwd',
  '<script>alert(1)</script>',
  '${7*7}',
  '{{7*7}}',
  '__proto__',
  'constructor',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  '-1',
  '0',
  '1e309',
  '9007199254740993',
  '0x10',
  '١٢٣',
  '😀'.repeat(50),
  '‮evil',
  'A'.repeat(10_000),
  'a@b.c'.padStart(5_000, 'x'),
];

const NASTY_NUMBERS = [
  0, -0, 1, -1, 0.5, 0.1 + 0.2, 1e-7, 1e21, 1e308, -1e308, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 2,
  Number.MIN_SAFE_INTEGER, 2 ** 31, 2 ** 32, -(2 ** 31),
];

export const hostileString = fc.oneof(
  { arbitrary: fc.constantFrom(...NASTY_STRINGS), weight: 3 },
  { arbitrary: fc.string({ maxLength: 60 }), weight: 3 },
  { arbitrary: fc.string({ unit: 'binary', maxLength: 60 }), weight: 2 },
);

const hostileNumber = fc.oneof(
  fc.constantFrom(...NASTY_NUMBERS),
  fc.integer(),
  fc.double({ noNaN: true }),
);

/** Any JSON value, with extra weight on wrong types for fields that are normally strings/numbers. */
const hostileJson: fc.Arbitrary<unknown> = fc.oneof(
  hostileString,
  hostileNumber,
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.oneof(hostileString, hostileNumber, fc.constant(null)), { maxLength: 4 }),
  fc.dictionary(hostileString, fc.oneof(hostileString, hostileNumber, fc.constant(null)), { maxKeys: 3 }),
);

/** Field may be missing entirely, valid-looking, or hostile. */
export const maybeField = <T>(valid: fc.Arbitrary<T>) =>
  fc.oneof({ arbitrary: valid, weight: 3 }, { arbitrary: hostileJson, weight: 4 }, { arbitrary: fc.constant(undefined), weight: 1 });

/** A request body: well-formed object, or raw malformed text, or a non-object JSON document. */
export function bodyOf(fields: Record<string, fc.Arbitrary<unknown>>): fc.Arbitrary<unknown> {
  return fc.oneof(
    { arbitrary: fc.record(fields), weight: 8 },
    { arbitrary: fc.constantFrom('', '{', '{"a":', 'null', '[]', '"str"', '123', '{"__proto__":{"role":"admin"}}', '\u0000'), weight: 2 },
    { arbitrary: fc.string({ maxLength: 40 }), weight: 1 },
    { arbitrary: fc.constant('['.repeat(5_000)), weight: 1 },
  );
}

export const idSegment = fc.oneof(
  fc.constantFrom('0', '-1', '1', '999999999999', '1.5', 'abc', '1 OR 1=1', '%00', '..%2f', 'NaN'),
  fc.integer({ min: -5, max: 50 }).map(String),
  fc.string({ maxLength: 20 }).map(encodeURIComponent),
);

export const queryValue = fc.oneof(
  hostileString.map(encodeURIComponent),
  hostileNumber.map(String),
);
