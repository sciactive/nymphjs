export class UnableToConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnableToConnectError';
  }
}
