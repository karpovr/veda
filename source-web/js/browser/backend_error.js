/**
 * A custom error class for backend errors.
 */
export default class BackendError extends Error {
  /**
   * Creates a new instance of BackendError.
   * @param {number} code - The error code associated with the backend error.
   */
  constructor(code, response) {
    const message = typeof code !== 'undefined' ? `${BackendError.#errorCodes[code]}` : undefined;
    super(message);
    this.name = 'BackendError';
    this.code = code;
    this.message = message;
    this.response = response;
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
    303: 'See Other',
    400: 'Bad Request',
    403: 'Forbidden',
    404: 'Not Found',
    422: 'Unprocessable Entity',
    423: 'Locked',
    429: 'Too Many Requests',
    430: 'Too Many Password Change Fails',
    463: 'Password Change Is Not Allowed',
    464: 'Secret Expired',
    465: 'Empty Password',
    466: 'New Password Is Equal To Old',
    467: 'Invalid Password',
    468: 'Invalid Secret',
    469: 'Password Expired',
    470: 'Ticket Not Found',
    471: 'Ticket Expired',
    472: 'Not Authorized',
    473: 'Authentication Failed',
    474: 'Not Ready',
    475: 'Fail Open Transaction',
    476: 'Fail Commit',
    477: 'Fail Store',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    503: 'Service Unavailable',
    904: 'Invalid Identifier',
    999: 'Database Modified Error',
    1021: 'Disk Full',
    1022: 'Duplicate Key',
    1118: 'Size Too Large',
    4000: 'Connect Error',
  }
}
