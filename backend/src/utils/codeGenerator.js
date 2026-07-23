const crypto = require('crypto');
const { CODE_CHARSET, DEFAULT_CODE_LENGTH } = require('../config/constants');

/**
 * Generates a cryptographically secure random code.
 * Uses uppercase letters and numbers, avoiding O/0 and I/1 confusion.
 *
 * @param {number} length - Length of the code
 * @param {string} prefix - Optional prefix to prepend
 * @returns {string} The generated code
 */
function generateCode(length = DEFAULT_CODE_LENGTH, prefix = '') {
  const charsetLength = CODE_CHARSET.length;
  const codeLength = length - prefix.length;

  if (codeLength <= 0) {
    throw new Error(`Prefix "${prefix}" is longer than or equal to the requested code length ${length}`);
  }

  let code = '';
  // Generate enough random bytes — each byte maps to a charset character
  const bytes = crypto.randomBytes(codeLength * 2); // extra to avoid modulo bias
  let byteIndex = 0;

  while (code.length < codeLength) {
    if (byteIndex >= bytes.length) {
      // Refill if needed
      const more = crypto.randomBytes(codeLength * 2);
      byteIndex = 0;
      for (let i = 0; i < more.length; i++) {
        bytes[i] = more[i];
      }
    }

    const byte = bytes[byteIndex++];
    // Reject bytes that would cause bias — accept only values < floor(256/charsetLength)*charsetLength
    const maxAcceptable = Math.floor(256 / charsetLength) * charsetLength;
    if (byte < maxAcceptable) {
      code += CODE_CHARSET[byte % charsetLength];
    }
  }

  return prefix ? `${prefix.toUpperCase()}${code}` : code;
}

/**
 * Generates a batch of unique codes.
 * Checks against an existing Set to prevent duplicates within the batch.
 *
 * @param {number} count
 * @param {number} length
 * @param {string} prefix
 * @param {Set<string>} existingCodes - Codes already in use (from DB lookup)
 * @returns {string[]} Array of unique codes
 */
function generateUniqueBatch(count, length = DEFAULT_CODE_LENGTH, prefix = '', existingCodes = new Set()) {
  const generated = new Set();
  const maxAttempts = count * 20; // safety limit
  let attempts = 0;

  while (generated.size < count) {
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error(
        `Could not generate ${count} unique codes after ${maxAttempts} attempts. ` +
        `Try a longer code length or smaller quantity.`
      );
    }

    const code = generateCode(length, prefix);
    if (!generated.has(code) && !existingCodes.has(code)) {
      generated.add(code);
    }
  }

  return Array.from(generated);
}

module.exports = { generateCode, generateUniqueBatch };
