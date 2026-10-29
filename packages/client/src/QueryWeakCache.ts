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

  set(queryJSON: string, promise: Promise<any>) {
    this.clean();

    if (!(promise instanceof Promise)) {
      return;
    }

    const weakRef = new WeakRef(promise);

    this.queries.set(queryJSON, weakRef);
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
