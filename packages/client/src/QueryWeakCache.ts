export class QueryWeakCache {
  private queries: Map<string, WeakRef<Promise<any>>> = new Map();

  get(queryJSON: string): Promise<any> | null {
    const weakRef = this.queries.get(queryJSON);
    const deref = weakRef && weakRef.deref();
    if (deref != null) {
      return deref;
    } else {
      this.queries.delete(queryJSON);
    }
    return null;
  }

  set<T extends Promise<any>>(queryJSON: string, promise: T): T {
    this.clean();

    if (!(promise instanceof Promise)) {
      return promise;
    }

    const newPromise = promise.finally(() => {
      this.delete(queryJSON);
    });

    const weakRef = new WeakRef(newPromise);

    this.queries.set(queryJSON, weakRef);

    return newPromise as T;
  }

  delete(queryJSON: string) {
    this.clean();

    this.queries.delete(queryJSON);
  }

  clean() {
    this.queries.forEach((value, key) => {
      const deref = value && value.deref();
      if (deref == null) {
        this.queries.delete(key);
      }
    });
  }
}
