import { HttpError } from '@nymphjs/nymph';

export class AmbiguousUserError extends HttpError {
  constructor(message: string) {
    super(message, 500);
    this.name = 'AmbiguousUserError';
  }
}
