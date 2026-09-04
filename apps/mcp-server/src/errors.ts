export type OpenPOSToolErrorCode = 'read_only' | 'not_found' | 'validation_error' | 'internal_error';

export class OpenPOSToolError extends Error {
  readonly code: OpenPOSToolErrorCode;

  constructor(message: string, code: OpenPOSToolErrorCode) {
    super(message);
    this.name = 'OpenPOSToolError';
    this.code = code;
  }
}

export class ReadOnlyError extends OpenPOSToolError {
  constructor(message = 'Database opened read-only. Start the server with --write to enable edits.') {
    super(message, 'read_only');
    this.name = 'ReadOnlyError';
  }
}

export class NotFoundError extends OpenPOSToolError {
  constructor(message: string) {
    super(message, 'not_found');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends OpenPOSToolError {
  constructor(message: string) {
    super(message, 'validation_error');
    this.name = 'ValidationError';
  }
}

export const getOpenPOSToolErrorCode = (error: unknown): OpenPOSToolErrorCode =>
  error instanceof OpenPOSToolError ? error.code : 'internal_error';
