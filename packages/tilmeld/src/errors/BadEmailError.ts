import { HttpError } from '@nymphjs/server';

export class BadEmailError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadEmailError';
  }
}
