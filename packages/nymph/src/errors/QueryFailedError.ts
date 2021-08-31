export class QueryFailedError extends Error {
  private query?: string;

  constructor(message: string, query?: string) {
    super(message);
    this.name = 'QueryFailedError';
    this.query = query;
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
