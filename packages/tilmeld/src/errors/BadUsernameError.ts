import { HttpError } from '@nymphjs/nymph';

export class BadUsernameError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadUsernameError';
  }
}
