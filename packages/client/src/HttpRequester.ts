export type HttpRequesterEventType = 'request' | 'response';
export type HttpRequesterRequestCallback = (
  requester: HttpRequester,
  url: string,
  options: RequestInit
) => void;
export type HttpRequesterResponseCallback = (
  requester: HttpRequester,
  response: Response
) => void;
export type HttpRequesterRequestOptions = {
  url: string;
  data: { [k: string]: any };
  dataType: string;
};

export default class HttpRequester {
  private fetch: WindowOrWorkerGlobalScope['fetch'];
  private xsrfToken: string | null = null;
  private requestCallbacks: HttpRequesterRequestCallback[] = [];
  private responseCallbacks: HttpRequesterResponseCallback[] = [];

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
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'response'
      ? 'responseCallbacks'
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
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'response'
      ? 'responseCallbacks'
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

  setXsrfToken(xsrfToken: string | null) {
    this.xsrfToken = xsrfToken;
  }

  async GET(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('GET', opt);
  }

  async POST(opt: HttpRequesterRequestOptions) {
    return await this._httpRequest('POST', opt);
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
    opt: HttpRequesterRequestOptions
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
      headers: {},
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

    if (this.xsrfToken !== null) {
      (options.headers as Record<string, string>)['X-Xsrf-Token'] =
        this.xsrfToken;
    }

    const response = await this.fetch(url, options);
    if (!response.ok) {
      const text = await response.text();
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
      throw response.status < 500
        ? new ClientError(errObj)
        : new ServerError(errObj);
    }
    for (let i = 0; i < this.responseCallbacks.length; i++) {
      this.responseCallbacks[i] && this.responseCallbacks[i](this, response);
    }
    const text = await response.text();
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
          'Server response was invalid: ' + JSON.stringify(text)
        );
      }
    } else {
      return text;
    }
  }
}

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidResponseError';
  }
}

export class ClientError extends Error {
  constructor(errObj: { textStatus: string }) {
    super(errObj.textStatus);
    this.name = 'ClientError';
    Object.assign(this, errObj);
  }
}

export class ServerError extends Error {
  constructor(errObj: { textStatus: string }) {
    super(errObj.textStatus);
    this.name = 'ServerError';
    Object.assign(this, errObj);
  }
}
