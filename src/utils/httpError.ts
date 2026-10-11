function createStatusCodeError(message: string, statusCode: number): Error {
  const statusCodeError = new Error(message) as Error & {
    statusCode: number;
  };
  statusCodeError.statusCode = statusCode;

  return statusCodeError;
}

export { createStatusCodeError };
    