import express = require('express');
import {Request, Response} from 'express-serve-static-core';
import {ExpressReqLogger, reqSerializer, resSerializer} from './';

const app: express.Application = express();
const logger = new ExpressReqLogger({
    logDebugRequestBody: true,
    logDebugResponseBody: true,
    pinoOptions: {
        enabled: true,
        level: 'debug',
        serializers: {
            req: reqSerializer,
            res: resSerializer,
        },
    }
});
app.use(logger.getMiddleware());

app.get('/', async (req: Request, res: Response) => {
    res.status(200);
    res.json({
        data: 'Hello World!'
    });
});

app.post('/', async (req: Request, res: Response) => {
    res.status(200);
    res.json({
        data: 'Hello World!'
    });
});

app.use(logger.getErrorHandlingMiddleware());

app.listen(3008);
