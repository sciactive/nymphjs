export class MethodFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MethodFailedError';
  }
}
