import { HttpError } from '@nymphjs/nymph';

export class AccessControlError extends HttpError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'AccessControlError';
  }
}
