export class EntityIsSleepingReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityIsSleepingReferenceError';
  }
}
