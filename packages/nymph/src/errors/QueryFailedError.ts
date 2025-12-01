export class QueryFailedError extends Error {
  private query?: string;
  public errorCode?: number;

  constructor(message: string, query?: string, errorCode?: number) {
    super(message);
    this.name = 'QueryFailedError';
    this.query = query;
    this.errorCode = errorCode;
  }

  public getQuery() {
    return this.query;
  }

  public toJSON() {
    if (process.env.NODE_ENV !== 'production') {
      return this;
    }
    return {
      name: this.name,
    };
  }
}
