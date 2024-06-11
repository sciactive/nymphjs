import { HttpError } from '@nymphjs/server';

export class BadDataError extends HttpError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadDataError';
  }
}
