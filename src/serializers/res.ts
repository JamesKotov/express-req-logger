import {Response} from 'express-serve-static-core';

const resProto = Object.create({}, {
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

export function resSerializer(res: Response) {
    const sRes = Object.create(resProto);

    sRes.status = res.statusCode;
    sRes.headers = res.getHeaders();

    return sRes;
}
