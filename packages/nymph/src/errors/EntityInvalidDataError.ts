/**
 * EntityInvalidDataError.
 *
 * This exception is meant to be thrown when an attempt to save an entity is
 * made, and validation on the data of that entity fails.
 */
export class EntityInvalidDataError extends Error {
  private fields: string[] = [];

  constructor(message: string) {
    super(message);
    this.name = 'EntityInvalidDataError';
  }

  public addField(name: string) {
    this.fields.push(name);
  }

  public getFields() {
    return this.fields;
  }
}
