import express = require('express');
import {Request, Response} from 'express-serve-static-core';
import {ExpressReqLogger, reqBodySerializer, resBodySerializer} from './';

const app: express.Application = express();
const logger = new ExpressReqLogger({
    pinoOptions: {
        enabled: true,
        serializers: {
            req: reqBodySerializer,
            res: resBodySerializer,
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
