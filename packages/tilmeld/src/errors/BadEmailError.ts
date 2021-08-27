export class BadEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadEmailError';
  }
}
