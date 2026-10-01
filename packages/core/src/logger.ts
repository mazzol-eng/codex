import pino, { type DestinationStream } from 'pino';
export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: [
          'password',
          '*.password',
          'token',
          '*.token',
          'authorization',
          '*.authorization',
          'credentials',
          '*.credentials',
          'email',
          '*.email',
          'req.headers.cookie',
          'req.headers.authorization',
        ],
        censor: '[REDACTED]',
      },
    },
    destination,
  );
}
export const logger = createLogger();
