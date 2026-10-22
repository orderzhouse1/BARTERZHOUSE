export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly isOperational: boolean;

  constructor(options: {
    message: string;
    code: string;
    statusCode?: number;
    fieldErrors?: Record<string, string[]>;
    isOperational?: boolean;
  }) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.fieldErrors = options.fieldErrors;
    this.isOperational = options.isOperational ?? true;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
