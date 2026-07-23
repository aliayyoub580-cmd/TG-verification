const { stringify } = require('csv-stringify');

/**
 * Converts an array of objects to a CSV string.
 *
 * @param {object[]} records
 * @param {string[]} columns - Column keys to include
 * @param {object} [headerMap] - Optional { key: 'Display Header' } map
 * @returns {Promise<string>}
 */
function objectsToCSV(records, columns, headerMap = {}) {
  return new Promise((resolve, reject) => {
    const header = columns.map((col) => headerMap[col] || col);

    const rows = records.map((record) =>
      columns.map((col) => {
        const val = record[col];
        if (val === null || val === undefined) return '';
        if (val instanceof Date) return val.toISOString();
        return String(val);
      })
    );

    stringify([header, ...rows], (err, output) => {
      if (err) reject(err);
      else resolve(output);
    });
  });
}

/**
 * Parses a CSV buffer into an array of objects.
 * Returns { records, errors }
 *
 * @param {Buffer} buffer
 * @param {string[]} requiredColumns
 * @returns {Promise<{ records: object[], errors: string[] }>}
 */
function parseCSVBuffer(buffer, requiredColumns = []) {
  return new Promise((resolve) => {
    const csvParser = require('csv-parser');
    const { Readable } = require('stream');

    const records = [];
    const errors = [];
    let rowIndex = 0;
    let headersValidated = false;

    const stream = Readable.from(buffer.toString('utf8'));

    stream
      .pipe(
        csvParser({
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
          skipComments: true,
        })
      )
      .on('headers', (headers) => {
        if (requiredColumns.length > 0) {
          const missing = requiredColumns.filter((col) => !headers.includes(col));
          if (missing.length > 0) {
            errors.push(`Missing required columns: ${missing.join(', ')}`);
          }
        }
        headersValidated = true;
      })
      .on('data', (row) => {
        rowIndex++;
        records.push({ ...row, _rowIndex: rowIndex });
      })
      .on('error', (err) => {
        errors.push(`CSV parse error: ${err.message}`);
        resolve({ records, errors });
      })
      .on('end', () => {
        resolve({ records, errors });
      });
  });
}

/**
 * Normalizes a submitted verification code:
 * - Trims whitespace
 * - Converts to uppercase
 */
function normalizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.trim();
}

function codeLookupKey(code) {
  return normalizeCode(code).toUpperCase();
}

module.exports = { objectsToCSV, parseCSVBuffer, normalizeCode, codeLookupKey };
