export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error', public details?: unknown) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, 'bad_request', d);
export const unauthorized = (m = 'غير مصرح') => new HttpError(401, m, 'unauthorized');
export const forbidden = (m = 'لا تملك صلاحية') => new HttpError(403, m, 'forbidden');
export const notFound = (m = 'غير موجود') => new HttpError(404, m, 'not_found');
export const conflict = (m: string) => new HttpError(409, m, 'conflict');
