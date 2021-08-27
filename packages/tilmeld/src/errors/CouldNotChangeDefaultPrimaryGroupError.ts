export class CouldNotChangeDefaultPrimaryGroupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CouldNotChangeDefaultPrimaryGroupError';
  }
}
