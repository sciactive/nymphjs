import { HttpError } from '@nymphjs/nymph';

export class BadEmailError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadEmailError';
  }
}
