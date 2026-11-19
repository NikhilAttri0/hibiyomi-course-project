import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'info',
  ...(isDev
    ? {}
    : {
        serializers: {
          req: (req: any) => ({
            method: req.method,
            url: req.url,
            headers: req.headers,
          }),
          res: (res: any) => ({
            statusCode: res.statusCode,
          }),
          err: pino.stdSerializers.err,
        },
      }),
});

export class LogContext {
  static fromRequest(req: any): Record<string, any> {
    return {
      request_id: req.headers['x-request-id'] || crypto.randomUUID(),
      user_id: req.user?.id,
      method: req.method,
      path: req.nextUrl?.pathname,
    };
  }
}
