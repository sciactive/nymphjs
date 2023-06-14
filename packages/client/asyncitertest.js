async function* iterate() {
  let values = [1, 2, 3];
  let finished = false;

  let promise = new Promise((resolve) => {
    setTimeout(() => {
      promise = new Promise((resolve) => {
        setTimeout(() => {
          values.push(4);
          promise = new Promise((resolve) => {
            setTimeout(() => {
              values.push(5, 6);
              finished = true;
              resolve();
            }, 3000);
          });
          resolve();
        }, 3000);
      });
      resolve();
    }, 0);
  });

  const iterable = {
    async *[Symbol.asyncIterator]() {
      do {
        await promise;

        while (values.length) {
          yield values.shift();
        }
      } while (!finished);
    },
  };

  yield* iterable;
}

(async () => {
  const iter = iterate();

  for await (let value of iter) {
    console.log(value);
  }

  console.log('done');

  for await (let value of ['a', 'b', 'c']) {
    console.log(value);
  }

  console.log('done');
})();
