import { HttpError } from '@nymphjs/server';

export class BadUsernameError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadUsernameError';
  }
}
