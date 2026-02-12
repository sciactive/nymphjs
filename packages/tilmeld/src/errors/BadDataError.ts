import { HttpError } from '@nymphjs/nymph';

export class BadDataError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadDataError';
  }
}
