import * as pino from 'pino';
import * as uuidv4 from 'uuid/v4';
import { Context } from 'koa';
import { errSerializer, reqSerializer, resSerializer } from './serializers';

declare module 'koa' {
  interface Context {
    id: string;
    start: Date;
    log: pino.Logger;
    responseTime: number;
  }
}

interface Error {
  status: number;
  message: string;
}

interface HeaderOpts {
  /**
   * Disables the X-Request-ID header when sending the response.
   */
  id: boolean;

  /**
   * Disables the Date header when sending the response.
   */
  date: boolean;

  /**
   * Disables the X-Response-Time header when sending the response.
   */
  responseTime: boolean;
}

export interface KoaReqLoggerOptions extends pino.LoggerOptions {
  /**
   * Forces the logger to always use the error severity, regardless of the response status.
   */
  alwaysError?: boolean;

  /**
   * Allows you to provide the default uuid generation function for the request id. The function should return the uuid as a string.
   */
  uuidFunction: Function;

  /**
   * Allows you to disable the headers that are added to requests. Can either be set to false to disable all or an object to disable specific headers.
   */
  headers: boolean | HeaderOpts;
}

export class KoaReqLogger {
  idHeader: boolean;
  startHeader: boolean;
  responseTimeHeader: boolean;
  uuidFunction: Function;
  alwaysError: boolean;
  logger: pino.Logger;

  /**
   * A logging middleware for koa, this middleware also sets the HTTP Date header,
   * sets the X-Response-Time header to the response time in milliseconds and sets the
   * X-Request-ID header to either a new uuidv4 or the request id passed into the request
   * @example
   * ``` javascript
   * const app = Koa();
   * const logger = KoaReqLogger();
   * app.use(logger.getMiddleware());
   * app.listen(3000);
   * ```
   * @param {object} opts An optional options object
   * @api public
   */
  constructor(opts: KoaReqLoggerOptions) {
    this.middleware = this.middleware.bind(this);

    opts = opts || {};

    // Set standard serializers, if no custom ones used
    opts.serializers = opts.serializers || {};
    opts.serializers.req = opts.serializers.req || reqSerializer;
    opts.serializers.res = opts.serializers.res || resSerializer;
    opts.serializers.err = opts.serializers.err || errSerializer;

    // Check if all headers should be disabled
    if (typeof opts.headers === 'boolean') {
      if (opts.headers == true) {
        this.idHeader = true;
        this.startHeader = true;
        this.responseTimeHeader = true;
      } else {
        this.idHeader = false;
        this.startHeader = false;
        this.responseTimeHeader = false;
      }
    } else {
      opts.headers = opts.headers || {};

      // Check if X-Request-ID Header should be disabled
      if (opts.headers.id !== undefined) {
        this.idHeader = opts.headers.id;
      } else {
        this.idHeader = true;
      }

      // Check if Date Header should be disabled
      if (opts.headers.date !== undefined) {
        this.startHeader = opts.headers.date;
      } else {
        this.startHeader = true;
      }

      // Check if X-Response-Time should be disabled
      if (opts.headers.responseTime !== undefined) {
        this.responseTimeHeader = opts.headers.responseTime;
      } else {
        this.responseTimeHeader = true;
      }
    }

    delete opts.headers;

    // Check if a uuidFunction has been passed in options and use if available
    if (typeof opts.uuidFunction === 'function') {
      this.uuidFunction = opts.uuidFunction;
      delete opts.uuidFunction;
    } else {
      this.uuidFunction = uuidv4.default;
    }

    delete opts.uuidFunction;

    this.alwaysError = opts.alwaysError || false;

    delete opts.alwaysError;

    this.logger = pino.default(opts);
  }

  /**
   * This function takes a request context and assigns a request id
   * This will either be a newly generated uuidv4 or the X-Request-ID header passed into the request
   * The resulting request id is then set as the X-Request-ID header on the response
   * @param ctx The current koa response context
   * @api private
   */
  setRequestId(ctx: Context) {
    if (ctx.get('X-Request-ID')) {
      ctx.id = ctx.get('X-Request-ID');
    } else {
      ctx.id = this.uuidFunction();
    }

    if (this.idHeader) {
      ctx.set('X-Request-ID', ctx.id);
    }
  }

  /**
   * This function sets the current date as the date header,
   * as well as logging the request and storing the start date for the calculation of the response time later
   * @param ctx The current koa context
   * @api private
   */
  startRequest(ctx: Context) {
    ctx.start = new Date();

    if (this.startHeader) {
      ctx.set('Date', ctx.start.toUTCString());
    } else {
      ctx.remove('Date'); // Remove default header set by koa
    }

    ctx.log.info({ req: ctx.req, startDate: ctx.start.toUTCString() }, `${ctx.request.ip} - ${ctx.method} ${ctx.path}`);
  }

  /**
   * This function calcuates the response time and sets the X-Response-Time header
   * @param ctx The current koa context
   * @api private
   */
  setResponseTime(ctx: Context) {
    let now: Date = new Date();
    ctx.responseTime = now.getTime() - ctx.start.getTime();

    if (this.responseTimeHeader) {
      ctx.set('X-Response-Time', `${ctx.responseTime}ms`);
    }
  }

  /**
   * This function logs the end of a request,
   * it also calls another function to calculate and set the X-Response-Time header
   * @param ctx The current koa context
   * @api private
   */
  endRequest(ctx: Context) {
    this.setResponseTime(ctx);

    ctx.log.info(
      { res: ctx.response, responseTime: ctx.responseTime, startDate: ctx.start.toUTCString() },
      `${ctx.ip} - ${ctx.method} ${ctx.path} - ${ctx.status} ${ctx.responseTime}ms`
    );
  }

  /**
   * This function logs the end of a request and the error that has been caught,
   * it also calls another function to calculate and set the X-Response-Time header
   * @param ctx The current koa context
   * @api private
   */
  endRequestError(e: Error, ctx: Context) {
    this.setResponseTime(ctx);

    // Construct error response
    if (e.status !== undefined) {
      ctx.status = e.status;
      ctx.body = {
        error: {
          code: e.status,
          message: e.message
        }
      };
    } else {
      ctx.status = 500;
      ctx.body = {
        error: {
          code: 500,
          message: 'Internal Server Error'
        }
      };
    }

    if (((ctx.status / 100) | 0) == 5 || this.alwaysError) {
      ctx.log.error(
        { res: ctx.response, err: e, responseTime: ctx.responseTime, startDate: ctx.start.toUTCString() },
        `${ctx.ip} - ${ctx.method} ${ctx.path} - ${ctx.status} ${ctx.responseTime}ms`
      );
    } else {
      ctx.log.warn(
        { res: ctx.response, err: e, responseTime: ctx.responseTime, startDate: ctx.start.toUTCString() },
        `${ctx.ip} - ${ctx.method} ${ctx.path} - ${ctx.status} ${ctx.responseTime}ms`
      );
    }
  }

  /**
   * This function handles all requests and is used as a koa middleware
   * @param ctx The current koa context
   * @param next The next function in the middleware stack
   * @api private
   */
  async middleware(ctx: Context, next: Function) {
    // Set the request id
    this.setRequestId(ctx);

    // Create a child of the logger with the request id as the key
    ctx.log = this.logger.child({ id: ctx.id });

    // Start the request logging
    this.startRequest(ctx);

    try {
      await next();

      // End the request logging
      this.endRequest(ctx);
    } catch (e) {
      // Handle error and end request logging
      this.endRequestError(e, ctx);
    }
  }

  /**
   * This function returns the middleware function for use in koa
   * @api public
   */
  getMiddleware() {
    return this.middleware;
  }
};