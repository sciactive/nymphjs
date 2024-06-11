import { HttpError } from '@nymphjs/server';

export class AccessControlError extends HttpError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'AccessControlError';
  }
}
