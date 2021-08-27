export class AccessControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessControlError';
  }
}
