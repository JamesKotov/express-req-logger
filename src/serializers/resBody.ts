import {Response} from 'express-serve-static-core';

const resProto = Object.create({}, {
    body: {
        enumerable: true,
        value: '',
        writable: true
    },
    headers: {
        enumerable: true,
        value: {},
        writable: true
    },
    status: {
        enumerable: true,
        value: 0,
        writable: true
    },
});

export function resBodySerializer(res: Response) {
    const sRes = Object.create(resProto);

    sRes.status = res.statusCode;
    sRes.headers = res.getHeaders();
    sRes.body = res.body;

    return sRes;
}
