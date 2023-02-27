export class HttpError extends Error {
  status?: number;
  statusText?: string;

  constructor(message: string, status?: number, statusText?: string) {
    super(message);

    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
  }
}
