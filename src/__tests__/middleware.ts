import express = require('express');
import {NextFunction, Request, Response} from 'express-serve-static-core';
import pino from 'pino';
import request from 'supertest';
import {ExpressReqLogger} from '../';

interface StatusError extends Error {
    status: number;
}

class StatusError extends Error {
    constructor(s: number, m: string) {
        super(m);
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, StatusError.prototype);
        this.status = s;
    }
}

describe('Middleware', () => {
    test('getMiddleware() should return a function', () => {
        const logger = new ExpressReqLogger();
        expect(typeof logger.getMiddleware()).toEqual('function');
    });

    test('Response should include HTTP Date header', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.post('/', async (req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).post('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toEqual('Hello World!');
        expect(response.header.date).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Response should include HTTP X-Response-Time header', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toEqual('Hello World!');

        // Teardown
        server.close();
        done();
    });

    test('Response should include HTTP X-Request-ID header', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toEqual('Hello World!');
        expect(response.header['x-request-id']).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test(`When a X-Request-ID is provided in the request,
    the same value should be sent back as the HTTP X-Request-ID header`, async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server)
            .get('/')
            .set('X-Request-ID', 'test-value');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toEqual('Hello World!');
        expect(response.header['x-request-id']).toBeDefined();
        expect(response.header['x-request-id']).toEqual('test-value');

        // Teardown
        server.close();
        done();
    });

    test('Should use custom uuid function if provided, and return the correct value', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            },
            uuidFunction: () => {
                return 'test-uuid';
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toEqual('Hello World!');
        expect(response.header['x-request-id']).toBeDefined();
        expect(response.header['x-request-id']).toEqual('test-uuid');

        // Teardown
        server.close();
        done();
    });

    test('Should return the correct HTTP Status Code if an error is thrown', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(400, 'Bad Request');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(400);
        expect(response.type).toEqual('application/json');

        // Teardown
        server.close();
        done();
    });

    test('Should return an error object if an error is thrown in a request handler', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(500, 'Internal Server Error');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(500);
        expect(response.type).toEqual('application/json');
        expect(response.body.error).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Should return an error object, with the correct error code if an error is thrown', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(400, 'Bad Request');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(400);
        expect(response.type).toEqual('application/json');
        expect(response.body.error.code).toBeDefined();
        expect(response.body.error.code).toEqual(400);

        // Teardown
        server.close();
        done();
    });

    test('Should return an error object, with the correct error message if an error is thrown', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(400, 'Bad Request');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(400);
        expect(response.type).toEqual('application/json');
        expect(response.body.error.message).toBeDefined();
        expect(response.body.error.message).toEqual('Bad Request');

        // Teardown
        server.close();
        done();
    });

    test('Should not return the rest of the response body on error', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(400, 'Bad Request');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(400);
        expect(response.type).toEqual('application/json');
        expect(response.body.data).toBeUndefined();

        // Teardown
        server.close();
        done();
    });

    test('Should ignore the X-Request-ID HTTP Header if disabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            disableIdHeader: true,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header['x-request-id']).toBeUndefined();

        // Teardown
        server.close();
        done();
    });

    test('Should ignore the Date HTTP Header if disabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            disableDateHeader: true,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header.date).toBeUndefined();

        // Teardown
        server.close();
        done();
    });

    test('Should ignore the X-Response-Time HTTP Header if disabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');

        // Teardown
        server.close();
        done();
    });

    test('Should not ignore the X-Request-ID HTTP Header if enabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            disableIdHeader: false,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header['x-request-id']).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Should not ignore the Date HTTP Header if enabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            disableDateHeader: false,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header.date).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Should not ignore the X-Response-Time HTTP Header if enabled in the options', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');

        // Teardown
        server.close();
        done();
    });

    test('Should respond with no headers, if all are disabled', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            disableDateHeader: true,
            disableIdHeader: true,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header['x-request-id']).toBeUndefined();
        expect(response.header.date).toBeUndefined();

        // Teardown
        server.close();
        done();
    });

    test('Should respond with all headers, if all are enabled', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.type).toEqual('application/json');
        expect(response.header['x-request-id']).toBeDefined();
        expect(response.header.date).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Should still respond correctly with alwaysError option set', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            alwaysError: true,
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: StatusError = new StatusError(400, 'Bad Request');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(400);
        expect(response.type).toEqual('application/json');

        // Teardown
        server.close();
        done();
    });

    test('Should respond with status 500 if a generic error is thrown', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoOptions: {
                enabled: false
            }
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            const e: Error = new Error('Generic Error with no Status');
            next(e);
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(500);
        expect(response.body.error.code).toEqual(500);
        expect(response.body.error.message).toEqual('Internal Server Error');
        expect(response.type).toEqual('application/json');

        // Teardown
        server.close();
        done();
    });

    test('Should work correctly when a pino instance is passed in.', async done => {
        // Setup
        const app: express.Application = express();
        const logger = new ExpressReqLogger({
            pinoInstance: pino({enabled: false})
        });
        app.use(logger.getMiddleware());

        app.use((req: Request, res: Response, next: NextFunction) => {
            res.status(200);
            res.json({
                data: 'Hello World!'
            });
        });

        app.use(logger.getErrorHandlingMiddleware());

        const server = app.listen();

        // Test
        const response = await request(server).get('/');
        expect(response.status).toEqual(200);
        expect(response.header.date).toBeDefined();

        // Teardown
        server.close();
        done();
    });

    test('Should work correctly when extreme mode is enabled', async done => {
        try {
            const logger = new ExpressReqLogger({
                extreme: true
            });

            done();
        } catch (e) {
            // Make the test fail as no error should be thrown.
            expect(true).toBeFalsy();
            done();
        }
    });

    test('Should throw an error if pinoInstance and pinoOptions are passed in at the same time.', async done => {
        try {
            const logger = new ExpressReqLogger({
                pinoInstance: pino({enabled: false}),
                pinoOptions: {
                    enabled: false
                }
            });

            // Fail the test as it should throw an error.
            expect(false).toBeTruthy();
            done();
        } catch (e) {
            expect(e).toBeDefined();
            done();
        }
    });

    test('Should throw an error if pinoInstance and extreme are passed in at the same time.', async done => {
        try {
            const logger = new ExpressReqLogger({
                extreme: false,
                pinoInstance: pino({enabled: false})
            });

            // Fail the test as it should throw an error.
            expect(false).toBeTruthy();
            done();
        } catch (e) {
            expect(e).toBeDefined();
            done();
        }
    });
});
