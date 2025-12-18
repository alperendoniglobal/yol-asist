import { Request, Response, NextFunction } from 'express';
import { QueryFailedError } from 'typeorm';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  if (err instanceof QueryFailedError) {
    console.error('Database query error:', err);
    res.status(400).json({
      error: 'Database query failed',
      ...(process.env.NODE_ENV === 'development' && {
        message: err.message,
        sqlMessage: (err as any).sqlMessage,
        code: (err as any).code,
        stack: err.stack
      }),
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && {
      message: err.message,
      stack: err.stack
    }),
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
