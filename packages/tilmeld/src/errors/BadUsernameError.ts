export class BadUsernameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadUsernameError';
  }
}
