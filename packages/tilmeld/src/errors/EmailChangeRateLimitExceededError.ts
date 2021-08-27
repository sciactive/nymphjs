export class EmailChangeRateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailChangeRateLimitExceededError';
  }
}
