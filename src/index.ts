import {NextFunction, Request, Response} from 'express-serve-static-core';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';
import {errSerializer, reqSerializer, resSerializer} from './serializers';

export {errSerializer, reqSerializer, resSerializer} from './serializers';

declare module 'express-serve-static-core' {
    interface Request {
        id: string;
        start: Date;
        log: pino.Logger;
        responseTime: number;
    }

    interface Response {
        body: string;
    }
}

// Workaround for extreme function as it doesn't currently exist in @types/pino
declare module 'pino' {
    function extreme(): any;
}

interface Error {
    status: number;
    message: string;
}

/** Function Signature for the optional Request ID Generation Function override. */
export type RequestIdFunction = () => string;

/** A set of configuration options used to configure a new instance of ExpressReqLogger. */
export interface ExpressReqLoggerOptions {
    /** When set to true, this option will force the log severity to be error for all non 2** response statuses. */
    alwaysError?: boolean;

    /**
     * Allows you to override the default request id generation function.
     * By default this is set to the uuidv4 function from the uuid node module.
     */
    uuidFunction?: RequestIdFunction;

    /** If set to true, this option will stop the X-Request-ID header being added to responses. */
    disableIdHeader?: boolean;

    /** If set to true, this option will stop the Date header being added to responses. */
    disableDateHeader?: boolean;

    /** If set to true, this option will stop the X-Response-Time header being added to responses. */
    disableResponseTimeHeader?: boolean;

    /**
     * These options will be passed to pino.
     * If no serializers for req, res or err are specified the defaults will be used.
     */
    pinoOptions?: pino.LoggerOptions;

    /** Configures pino the use extreme mode for added performance. */
    extreme?: boolean;

    /**
     * Allows you to pass your own instance of Pino preconfigured to use in the logging middleware.
     * This option is not compatible with pinoOptions or extreme,
     * as they don't make sense if you pass a preconfigured pino object.
     * If a preconfigured instance is used requests, responses and errors will not be serialized.
     */
    pinoInstance?: pino.Logger;

    /**
     * Log request raw body with debug level
     */
    logDebugRequestBody?: boolean

    /**
     * Log response raw body with debug level
     */
    logDebugResponseBody?: boolean
}

export class ExpressReqLogger {
    /** Set to true if the X-Request-ID header should be included in responses. */
    private idHeader: boolean;

    /** Set to true if the Date header should be included in responses. */
    private startHeader: boolean;

    /** The function used to generate the ids used in the X-Request-ID header. */
    private uuidFunction: RequestIdFunction;

    /** If set to true, the error severity will be used for all non 2xx status responses. */
    private alwaysError: boolean;

    /** The pino logger instance used internally by the module. */
    private logger: pino.Logger;

    private logDebugRequestBody: boolean;

    private logDebugResponseBody: boolean;

    /**
     * Create a new instance of ExpressReqLogger to use in a Express App.
     * @param options - ExpressReqLoggerOptions to configure the middleware.
     * @param options.alwaysError - When set to true, the log severity will be error for all non 2xx status responses.
     * @param options.uuidFunction - Allows you to override the default X-Request-ID generation function.
     * @param options.disableIdHeader - If set to true, the X-Request-ID header is not included in responses.
     * @param options.disableDateHeader - If set to true, the Date header is not included in responses.
     * @param options.disableResponseTimeHeader - If set to true, the X-Response-Time header isn't included in responses
     * @param options.pinoOptions - This object will be passed to pino to configure the logger instance.
     * @param options.extreme - If set to true, the extreme mode of pino will be used for extra performance.
     * @param options.pinoInstance - Pass in your own preconfigured instance of the pino logger.
     * @param options.logDebugRequestBody - Log request raw body with debug level
     * @param options.logDebugResponseBody - Log response raw body with debug level
     */
    constructor(options?: ExpressReqLoggerOptions) {
        this.middleware = this.middleware.bind(this);
        this.errorHandlingMiddleware = this.errorHandlingMiddleware.bind(this);

        const opts: ExpressReqLoggerOptions = options || {};

        if (opts.pinoInstance && opts.pinoOptions) {
            throw new Error('Pino Options cannot be used with a Pino Instance. Only 1 can be used at a time.');
        }

        if (opts.pinoInstance && opts.extreme !== undefined) {
            throw new Error(`Extreme cannot be used with a Pino Instance.
        Configure extreme mode on the pino instance before passing into express-req-logger.`);
        }

        if (opts.pinoInstance) {
            this.logger = opts.pinoInstance;
        } else {
            opts.pinoOptions = opts.pinoOptions || {};

            // Set standard serializers, if no custom ones used
            opts.pinoOptions.serializers = opts.pinoOptions.serializers || {};
            opts.pinoOptions.serializers.req = opts.pinoOptions.serializers.req || reqSerializer;
            opts.pinoOptions.serializers.res = opts.pinoOptions.serializers.res || resSerializer;
            opts.pinoOptions.serializers.err = opts.pinoOptions.serializers.err || errSerializer;

            if (opts.extreme) {
                this.logger = pino(opts.pinoOptions, pino.extreme());
            } else {
                this.logger = pino(opts.pinoOptions);
            }
        }

        // Check if X-Request-ID header has been disabled
        this.idHeader = opts.disableIdHeader != true;

        // Check if Date header has been disabled
        this.startHeader = opts.disableDateHeader != true;

        // Check if a uuidFunction has been passed in options and use if available
        if (typeof opts.uuidFunction === 'function') {
            this.uuidFunction = opts.uuidFunction;
            delete opts.uuidFunction;
        } else {
            this.uuidFunction = uuidv4;
        }

        delete opts.uuidFunction;

        this.alwaysError = opts.alwaysError || false;

        delete opts.alwaysError;

        this.logDebugRequestBody = !!opts.logDebugRequestBody;

        this.logDebugResponseBody = !!opts.logDebugResponseBody;
    }

    /**
     * This function returns the middleware function for use in express.
     */
    public getErrorHandlingMiddleware() {
        return this.errorHandlingMiddleware;
    }

    /**
     * This function returns the middleware function for use in express.
     */
    public getMiddleware() {
        return this.middleware;
    }

    /**
     * This function logs the end of a request and the error that has been caught,
     * it also calls another function to calculate and set the X-Response-Time header.
     * @param e - Error object
     * @param req - The current express request
     * @param res - The current express response.
     */
    public endRequestError(e: Error, req: Request, res: Response) {

        req.log.error(
            {err: e}
        );

        // Construct error response
        if (e.status !== undefined) {
            res.status(e.status);
            res.json({
                error: {
                    code: e.status,
                    message: e.message
                }
            });
        } else {
            res.status(500);
            res.json({
                error: {
                    code: 500,
                    message: 'Internal Server Error'
                }
            });
        }

        res.end();
    }

    /**
     * This function takes a request context and assigns a request id.
     * This will either be a newly generated uuid v4 or the X-Request-ID header passed into the request.
     * The resulting request id is then set as the X-Request-ID header on the response.
     * @param req - The current express request
     * @param res - The current express response
     */
    private setRequestId(req: Request, res: Response) {
        if (req.get('X-Request-ID')) {
            req.id = req.get('X-Request-ID') as string;
        } else {
            req.id = this.uuidFunction();
        }

        if (this.idHeader) {
            res.set('X-Request-ID', req.id);
        }
    }

    /**
     * This function calcuates the response time and sets the X-Response-Time header.
     * @param req - The current express request
     * @param res - The current express response.
     */
    private setResponseTime(req: Request, res: Response) {
        const now: Date = new Date();
        req.responseTime = now.getTime() - req.start.getTime();
    }

    /**
     * This function logs the end of a request,
     * it also calls another function to calculate and set the X-Response-Time header.
     * @param req - The current express request
     * @param res - The current express response.
     */
    private endRequest(req: Request, res: Response) {
        this.setResponseTime(req, res);

        const status: any = res.statusCode;

        if (this.logDebugRequestBody) {
            req.log.debug({requestBody: req.body})
        }

        if (this.logDebugResponseBody) {
            req.log.debug({responseBody: res.body})
        }

        if (status < 400) {
            return req.log.info(
                {res, responseTime: req.responseTime, startDate: req.start.toUTCString()},
                this.getResponseEndSuffix(req, res)
            );
        }

        // tslint:disable-next-line:no-bitwise
        if (((status / 100) | 0) === 5 || this.alwaysError) {
            return req.log.error(
                {res, responseTime: req.responseTime, startDate: req.start.toUTCString()},
                this.getResponseEndSuffix(req, res)
            );
        }

        req.log.warn(
            {res, responseTime: req.responseTime, startDate: req.start.toUTCString()},
            this.getResponseEndSuffix(req, res)
        );
    }

    private getResponseEndSuffix(req: Request, res: Response | null): string {
        const result = `${req.ip} - ${req.method} ${req.path}`;
        if (!res) {
            return result;
        }

        return `${result} - ${res.statusCode} ${req.responseTime}ms`;
    }

    /**
     * This function handles all requests and is used as a express middleware.
     * @param req - The current express request
     * @param res - The current express response.
     * @param next - The next function in the middleware stack.
     */
    private async middleware(req: Request, res: Response, next: NextFunction) {

        const self = this;

        // Set the request id
        self.setRequestId(req, res);

        // Create a child of the logger with the request id as the key
        req.log = self.logger.child({id: req.id});

        req.start = new Date();

        if (this.startHeader) {
            res.set('Date', req.start.toUTCString());
        } else {
            res.removeHeader('Date'); // Remove default header set by express
        }

        req.log.info({req, startDate: req.start.toUTCString()}, this.getResponseEndSuffix(req, null));

        const defaultWrite = res.write;
        const defaultEnd = res.end;
        const resChunks: any = [];

        // @ts-ignore
        res.write = (...restArgs) => {
            resChunks.push(Buffer.from(restArgs[0]));
            // @ts-ignore
            defaultWrite.apply(res, restArgs);
        };

        // @ts-ignore
        res.end = (...restArgs) => {
            if (restArgs[0]) {
                resChunks.push(Buffer.from(restArgs[0]));
            }
            res.body = Buffer.concat(resChunks).toString('utf8');

            const contentType: string = String(res.getHeader('content-type') || '');
            if (contentType.startsWith('application/json')) {
                try {
                    res.body = JSON.parse(res.body);
                } catch (err) {
                    req.log.error({err}, 'Error parsing response body');
                }
            }

            // @ts-ignore
            defaultEnd.apply(res, restArgs);
        };

        res.on('finish', () =>
            // End the request logging
            self.endRequest(req, res)
        );

        res.on('error', (e: Error) =>
            // End the request logging
            self.endRequestError(e, req, res)
        );

        await next();

    }

    private errorHandlingMiddleware(e: Error, req: Request, res: Response, next: NextFunction) {
        this.endRequestError(e, req, res);
    }
}

export default ExpressReqLogger;
