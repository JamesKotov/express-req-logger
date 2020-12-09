export function errSerializer(err: any) {
    const obj: any = {
        message: err.message,
        stack: err.stack,
        type: err.constructor.name
    };

    for (const key in err) {
        // noinspection JSUnfilteredForInLoop
        if (obj[key] === undefined) {
            // noinspection JSUnfilteredForInLoop
            obj[key] = err[key];
        }
    }

    return obj;
}
