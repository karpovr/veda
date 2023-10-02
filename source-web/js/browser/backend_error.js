/**
 * A custom error class for backend errors.
 */
export default class BackendError extends Error {
  /**
   * Creates a new instance of BackendError.
   * @param {number} code - The error code associated with the backend error.
   */
  constructor(code) {
    const message = typeof code !== 'undefined' ? `${BackendError.#errorCodes[code]}` : undefined;
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.message = message;
  }

  /**
   * String representation of the BackendError.
   * @returns {string} The string representation of the BackendError.
   */
  toString() {
    return `${this.name} ${this.code}: ${this.message}`;
  }

  /**
   * The mapping of error codes to error messages.
   */
  static #errorCodes = {
    0: 'Server unavailable',
    400: 'Bad request',
    403: 'Forbidden',
    404: 'Not found',
    422: 'Unprocessable entity',
    423: 'Locked',
    429: 'Too many requests',
    430: 'Too many password change fails',
    463: 'Password change is not allowed',
    464: 'Secret expired',
    465: 'Empty password',
    466: 'New password is equal to old',
    467: 'Invalid password',
    468: 'Invalid secret',
    469: 'Password expired',
    470: 'Ticket not found',
    471: 'Ticket expired',
    472: 'Not authorized',
    473: 'Authentication failed',
    474: 'Not ready',
    475: 'Fail open transaction',
    476: 'Fail commit',
    477: 'Fail store',
    500: 'Internal server error',
    501: 'Not implemented',
    503: 'Service unavailable',
    904: 'Invalid identifier',
    999: 'Database modified error',
    1021: 'Disk full',
    1022: 'Duplicate key',
    1118: 'Size too large',
    4000: 'Connect error',
  }
}
