export class BadDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadDataError';
  }
}
