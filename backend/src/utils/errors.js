// Every error the API sends looks like: { error: { code, message } }
// Routes just "throw new ApiError(...)" and the error handler in app.js
// turns it into the right HTTP response.

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (msg) => new ApiError(400, 'VALIDATION_ERROR', msg);
const unauthenticated = (msg = 'Please log in first') => new ApiError(401, 'UNAUTHENTICATED', msg);
const forbidden = (msg = 'You are not allowed to do this') => new ApiError(403, 'FORBIDDEN', msg);
const notFound = (msg = 'Not found') => new ApiError(404, 'NOT_FOUND', msg);
const conflict = (msg) => new ApiError(409, 'CONFLICT', msg);

module.exports = { ApiError, badRequest, unauthenticated, forbidden, notFound, conflict };
