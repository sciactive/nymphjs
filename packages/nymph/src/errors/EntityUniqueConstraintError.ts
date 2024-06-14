export class EntityUniqueConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityUniqueConstraintError';
  }
}
