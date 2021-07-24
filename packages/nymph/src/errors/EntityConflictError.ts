export class EntityConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityConflictError';
  }
}
