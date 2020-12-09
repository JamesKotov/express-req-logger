import {errSerializer, reqSerializer, resSerializer} from '../';

describe('Serializers', () => {
  describe('reqSerializer', () => {
    test('Should serialize a standard req object', () => {
        const req: any = {
            headers: ['header', 'array'],
            id: 'id',
            ip: '127.0.0.1',
            method: 'method',
            url: '/url',
        };

        const serialized = reqSerializer(req);

        expect(serialized).toEqual(req);
    });
    test('Should serialize a standard req object', () => {
        const req: any = {
            headers: ['header', 'array'],
            id: 'id',
            ip: '127.0.0.1',
            method: 'method',
            url: '/url',
        };

        const serialized = reqSerializer(req);

        expect(serialized).toEqual({
            headers: ['header', 'array'],
            id: 'id',
            ip: '127.0.0.1',
            method: 'method',
            url: '/url',
        });
    });
    test('Should serialize a non-standard req object, and remove all unwanted members', () => {
        const req: any = {
            headers: ['header', 'array'],
            id: 'id',
            ip: '127.0.0.1',
            method: 'method',
            nonStandard: 'method',
            url: '/url',
        };

        const serialized = reqSerializer(req);

        expect(serialized.nonStandard).toBeUndefined();
        expect(serialized.ip).toBeDefined();
        expect(serialized.ip).toEqual('127.0.0.1');
    });
  });

  describe('resSerializer', () => {
    test('Should serialize a standard res object', () => {
        const res: any = {
            getHeaders: () => ['header', 'array'],
            statusCode: 200
        };

        const serialized = resSerializer(res);

        expect(serialized).toEqual({
            headers: ['header', 'array'],
            status: 200
        });
    });

    test('Should serialize a standard res object', () => {
        const res: any = {
            body: 'blah',
            getHeaders: () => ['header', 'array'],
            statusCode: 200
        };

        const serialized = resSerializer(res);

        expect(serialized).toEqual({
            headers: ['header', 'array'],
            status: 200
        });
    });

    test('Should serialize a non-standard res object, and remove all unwanted members', () => {
        const res: any = {
            getHeaders: () => ['header', 'array'],
            nonStandard: 'member',
            statusCode: 200
        };

        const serialized = resSerializer(res);

        expect(serialized.nonStandard).toBeUndefined();
        expect(serialized.status).toBeDefined();
        expect(serialized.status).toEqual(200);
    });
  });

  describe('errSerializer', () => {
    test('Should serialize a standard err object', () => {
      const err = {
        message: 'Error Message',
        stack: 'Error Stack',
        type: 'Error Name'
      };

      const serialized = errSerializer(err);

      expect(serialized.message).toEqual(err.message);
      expect(serialized.stack).toEqual(err.stack);
    });

    test('Should serialize a non-standard err object, retaining all non-standard members', () => {
      const err = {
        message: 'Error Message',
        nonStandard: 'member',
        stack: 'Error Stack',
        type: 'Error Name'
      };

      const serialized = errSerializer(err);

      expect(serialized.nonStandard).toBeDefined();
      expect(serialized.nonStandard).toEqual('member');
    });
  });
});
