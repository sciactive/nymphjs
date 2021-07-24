export class ClassNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassNotAvailableError';
  }
}
