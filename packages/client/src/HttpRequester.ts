import {
  fetchEventSource,
  EventStreamContentType,
} from 'fetch-event-source-hperrin';

export type HttpRequesterEventType = 'request' | 'response';
export type HttpRequesterRequestCallback = (
  requester: HttpRequester,
  url: string,
  options: RequestInit,
) => void;
export type HttpRequesterResponseCallback = (
  requester: HttpRequester,
  response: Response,
  text: string,
) => void;
export type HttpRequesterIteratorCallback = (
  requester: HttpRequester,
  url: string,
  headers: Record<string, string>,
) => void;
export type HttpRequesterRequestOptions = {
  url: string;
  headers?: { [k: string]: any };
  data: { [k: string]: any };
  dataType: string;
};

export interface AbortableAsyncIterator<
  T extends any = any,
> extends AsyncIterable<T> {
  abortController: AbortController;
}

export default class HttpRequester {
  private fetch: WindowOrWorkerGlobalScope['fetch'];
  private requestCallbacks: HttpRequesterRequestCallback[] = [];
  private responseCallbacks: HttpRequesterResponseCallback[] = [];
  private iteratorCallbacks: HttpRequesterIteratorCallback[] = [];

  static makeUrl(url: string, data: { [k: string]: any }) {
    if (!data) {
      return url;
    }
    for (let [key, value] of Object.entries(data)) {
      url =
        url +
        (url.indexOf('?') !== -1 ? '&' : '?') +
        encodeURIComponent(key) +
        '=' +
        encodeURIComponent(JSON.stringify(value));
    }
    return url;
  }

  constructor(ponyFetch?: WindowOrWorkerGlobalScope['fetch']) {
    this.fetch = ponyFetch ? ponyFetch : (...args) => fetch(...args);
  }

  on<T extends HttpRequesterEventType>(
    event: T,
    callback: T extends 'request'
      ? HttpRequesterRequestCallback
      : T extends 'response'
        ? HttpRequesterResponseCallback
        : T extends 'iterator'
          ? HttpRequesterIteratorCallback
          : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'response'
        ? 'responseCallbacks'
        : T extends 'iterator'
          ? 'iteratorCallbacks'
          : never;
    if (!(prop in this)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  off<T extends HttpRequesterEventType>(
    event: T,
    callback: T extends 'request'
      ? HttpRequesterRequestCallback
      : T extends 'response'
        ? HttpRequesterResponseCallback
        : T extends 'iterator'
          ? HttpRequesterIteratorCallback
          : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'response'
        ? 'responseCallbacks'
        : T extends 'iterator'
          ? 'iteratorCallbacks'
          : never;
    if (!(prop in this)) {
      return false;
    }
    // @ts-ignore: The callback should always be the right type here.
    const i = this[prop].indexOf(callback);
    if (i > -1) {
      // @ts-ignore: The callback should always be the right type here.
      this[prop].splice(i, 1);
    }
    return true;
  }

  async GET(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('GET', opt);
  }

  async POST(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('POST', opt);
  }

  async POST_ITERATOR(opt: HttpRequesterRequestOptions) {
    return await this._iteratorRequest('POST', opt);
  }

  async PUT(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('PUT', opt);
  }

  async PATCH(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('PATCH', opt);
  }

  async DELETE(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('DELETE', opt);
  }

  async _httpRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    opt: HttpRequesterRequestOptions,
  ) {
    const dataString = JSON.stringify(opt.data);
    let url = opt.url;
    if (method === 'GET') {
      // TODO: what should this size be?
      // && dataString.length < 1) {
      url = HttpRequester.makeUrl(opt.url, opt.data);
    }
    const options: RequestInit = {
      method,
      headers: opt.headers ?? {},
      credentials: 'include',
    };

    if (method !== 'GET' && opt.data) {
      (options.headers as Record<string, string>)['Content-Type'] =
        'application/json';
      options.body = dataString;
    }

    for (let i = 0; i < this.requestCallbacks.length; i++) {
      this.requestCallbacks[i] && this.requestCallbacks[i](this, url, options);
    }

    const response = await this.fetch(url, options);
    let text: string;
    try {
      text = await response.text();
    } catch (e: any) {
      throw new InvalidResponseError(
        'Server response did not contain valid text body.',
      );
    }
    if (!response.ok) {
      let errObj;
      try {
        errObj = JSON.parse(text);
      } catch (e: any) {
        if (!(e instanceof SyntaxError)) {
          throw e;
        }
      }

      if (typeof errObj !== 'object') {
        errObj = {
          textStatus: response.statusText,
        };
      }
      errObj.status = response.status;
      throw response.status < 200
        ? new InformationalError(response, errObj)
        : response.status < 300
          ? new SuccessError(response, errObj)
          : response.status < 400
            ? new RedirectError(response, errObj)
            : response.status < 500
              ? new ClientError(response, errObj)
              : new ServerError(response, errObj);
    }
    for (let i = 0; i < this.responseCallbacks.length; i++) {
      this.responseCallbacks[i] &&
        this.responseCallbacks[i](this, response, text);
    }
    if (opt.dataType === 'json') {
      if (!text.length) {
        throw new InvalidResponseError('Server response was empty.');
      }
      try {
        return JSON.parse(text);
      } catch (e: any) {
        if (!(e instanceof SyntaxError)) {
          throw e;
        }
        throw new InvalidResponseError(
          'Server response was invalid: ' + JSON.stringify(text),
        );
      }
    } else {
      return text;
    }
  }

  async _iteratorRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    opt: HttpRequesterRequestOptions,
  ): Promise<AbortableAsyncIterator> {
    const dataString = JSON.stringify(opt.data);
    let url = opt.url;
    if (method === 'GET') {
      // TODO: what should this size be?
      // && dataString.length < 1) {
      url = HttpRequester.makeUrl(opt.url, opt.data);
    }
    const hasBody = method !== 'GET' && opt.data;
    const headers: Record<string, string> = opt.headers ?? {};

    if (hasBody) {
      headers['Content-Type'] = 'application/json';
    }

    for (let i = 0; i < this.iteratorCallbacks.length; i++) {
      this.iteratorCallbacks[i] &&
        this.iteratorCallbacks[i](this, url, headers);
    }

    const responses: any[] = [];
    let nextResponseResolve: (value: void) => void;
    let nextResponseReadyPromise = new Promise<void>((res) => {
      nextResponseResolve = res;
    });
    let responsesDone = false;
    let serverResponse: Response;

    const ctrl = new AbortController();

    fetchEventSource(url, {
      openWhenHidden: true,
      fetch: this.fetch,

      method,
      headers,
      credentials: 'include',
      body: hasBody ? dataString : undefined,
      signal: ctrl.signal,

      async onopen(response) {
        serverResponse = response;
        if (response.ok) {
          if (response.headers.get('content-type') === EventStreamContentType) {
            throw new InvalidResponseError(
              'Server response is not an event stream.',
            );
          }

          // Response is ok, wait for messages.
          return;
        }

        let text: string = '';
        try {
          text = await response.text();
        } catch (e: any) {
          // Ignore error here.
        }

        let errObj;
        try {
          errObj = JSON.parse(text);
        } catch (e: any) {
          if (!(e instanceof SyntaxError)) {
            throw e;
          }
        }

        if (typeof errObj !== 'object') {
          errObj = {
            textStatus: response.statusText,
          };
        }
        errObj.status = response.status;
        throw response.status < 200
          ? new InformationalError(response, errObj)
          : response.status < 300
            ? new SuccessError(response, errObj)
            : response.status < 400
              ? new RedirectError(response, errObj)
              : response.status < 500
                ? new ClientError(response, errObj)
                : new ServerError(response, errObj);
      },

      onmessage(event) {
        if (event.event === 'next') {
          let text = event.data;

          if (opt.dataType === 'json') {
            if (!text.length) {
              responses.push(
                new InvalidResponseError('Server response was empty.'),
              );
            } else {
              try {
                responses.push(JSON.parse(text));
              } catch (e: any) {
                if (!(e instanceof SyntaxError)) {
                  responses.push(e);
                } else {
                  responses.push(
                    new InvalidResponseError(
                      'Server response was invalid: ' + JSON.stringify(text),
                    ),
                  );
                }
              }
            }
          } else {
            responses.push(text);
          }
        } else if (event.event === 'error') {
          let text = event.data;

          let errObj;
          try {
            errObj = JSON.parse(text);
          } catch (e: any) {
            if (!(e instanceof SyntaxError)) {
              throw e;
            }
          }

          if (typeof errObj !== 'object') {
            errObj = {
              status: 500,
              textStatus: 'Iterator Error',
            };
          }
          responses.push(
            errObj.status < 200
              ? new InformationalError(serverResponse, errObj)
              : errObj.status < 300
                ? new SuccessError(serverResponse, errObj)
                : errObj.status < 400
                  ? new RedirectError(serverResponse, errObj)
                  : errObj.status < 500
                    ? new ClientError(serverResponse, errObj)
                    : new ServerError(serverResponse, errObj),
          );
        } else if (event.event === 'finished') {
          responsesDone = true;
        } else if (event.event === 'ping') {
          // Ignore keep-alive pings.
          return;
        }

        const resolve = nextResponseResolve;
        if (!responsesDone) {
          nextResponseReadyPromise = new Promise<void>((res) => {
            nextResponseResolve = res;
          });
        }

        // Resolve the promise to continue any waiting iterator.
        resolve();
      },

      onclose() {
        responses.push(
          new ConnectionClosedUnexpectedlyError(
            'The connection to the server was closed unexpectedly.',
          ),
        );

        responsesDone = true;
        nextResponseResolve();
      },

      onerror(err) {
        // Rethrow to stop the operation.
        throw err;
      },
    }).catch((err) => {
      responses.push(
        new ConnectionError('The connection could not be established: ' + err),
      );

      responsesDone = true;
      nextResponseResolve();
    });

    const iterator: AbortableAsyncIterator = {
      abortController: ctrl,
      async *[Symbol.asyncIterator]() {
        do {
          await nextResponseReadyPromise;

          while (responses.length) {
            yield responses.shift();
          }
        } while (!responsesDone);
      },
    };

    return iterator;
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

export class ConnectionClosedUnexpectedlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionClosedUnexpectedlyError';
  }
}

export class ConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class HttpError extends Error {
  status: number;
  statusText: string;

  constructor(
    name: string,
    response: Response,
    errObj: { textStatus: string },
  ) {
    super(errObj.textStatus);
    this.name = name;
    this.status = response.status;
    this.statusText = response.statusText;
    Object.assign(this, errObj);
  }
}

export class InformationalError extends HttpError {
  constructor(response: Response, errObj: { textStatus: string }) {
    super('InformationalError', response, errObj);
  }
}

export class SuccessError extends HttpError {
  constructor(response: Response, errObj: { textStatus: string }) {
    super('SuccessError', response, errObj);
  }
}

export class RedirectError extends HttpError {
  constructor(response: Response, errObj: { textStatus: string }) {
    super('RedirectError', response, errObj);
  }
}

export class ClientError extends HttpError {
  constructor(response: Response, errObj: { textStatus: string }) {
    super('ClientError', response, errObj);
  }
}

export class ServerError extends HttpError {
  constructor(response: Response, errObj: { textStatus: string }) {
    super('ServerError', response, errObj);
  }
}
