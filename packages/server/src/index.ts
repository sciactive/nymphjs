import type { OptionsJson } from 'body-parser';
import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import {
  Nymph,
  Entity,
  EntityConflictError,
  EntityConstructor,
  EntityInterface,
  EntityJson,
  EntityPatch,
  EntityReference,
  InvalidParametersError,
  TilmeldAccessLevels,
  classNamesToEntityConstructors,
  Options,
  Selector,
} from '@nymphjs/nymph';
import { EntityInvalidDataError } from '@nymphjs/nymph';

import { HttpError } from './HttpError';

export { HttpError };

type NymphResponse = Response<any, { nymph: Nymph }>;

const NOT_FOUND_ERROR = 'Entity is not found.';

/**
 * A REST server middleware creator for Nymph.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default function createServer(
  nymph: Nymph,
  { jsonOptions = {} }: { jsonOptions?: OptionsJson } = {}
) {
  const rest = express();
  rest.use(cookieParser());
  rest.use(express.json(jsonOptions || {}));

  function instantiateNymph(
    _request: Request,
    response: NymphResponse,
    next: NextFunction
  ) {
    response.locals.nymph = nymph.clone();
    next();
  }

  function authenticateTilmeld(
    request: Request,
    response: NymphResponse,
    next: NextFunction
  ) {
    if (response.locals.nymph.tilmeld) {
      response.locals.nymph.tilmeld.request = request;
      response.locals.nymph.tilmeld.response = response;
      try {
        response.locals.nymph.tilmeld.authenticate();
      } catch (e: any) {
        httpError(response, 500, e);
        return;
      }
    }
    next();
  }

  function unauthenticateTilmeld(
    _request: Request,
    response: NymphResponse,
    next: NextFunction
  ) {
    if (response.locals.nymph.tilmeld) {
      response.locals.nymph.tilmeld.request = null;
      response.locals.nymph.tilmeld.response = null;
      try {
        response.locals.nymph.tilmeld.clearSession();
      } catch (e: any) {
        httpError(response, 500, e);
        return;
      }
    }
    next();
  }

  function getActionData(request: Request): { action: string; data: any } {
    if (request.method === 'GET') {
      if (
        typeof request.query?.action !== 'string' ||
        typeof request.query?.data !== 'string'
      ) {
        return {
          action: '',
          data: {},
        };
      }
      return {
        action: JSON.parse(request.query.action) ?? '',
        data: JSON.parse(request.query.data),
      };
    } else {
      return {
        action: request.body.action ?? '',
        data: request.body.data,
      };
    }
  }

  // Create a new instance of Nymph for the request/response.
  rest.use(instantiateNymph);

  // Authenticate before the request.
  rest.use(authenticateTilmeld);

  rest.get('/', async (request, response: NymphResponse) => {
    try {
      const { action, data } = getActionData(request);
      if (['entity', 'entities', 'uid'].indexOf(action) === -1) {
        httpError(response, 400);
        return;
      }
      if (['entity', 'entities'].indexOf(action) !== -1) {
        if (!Array.isArray(data)) {
          httpError(response, 400);
          return;
        }
        const count = data.length;
        if (count < 1 || typeof data[0] !== 'object') {
          httpError(response, 400);
          return;
        }
        if (!('class' in data[0])) {
          httpError(response, 400);
          return;
        }
        let [options, ...selectors] = data as [Options, ...Selector[]];
        let EntityClass;
        try {
          EntityClass = response.locals.nymph.getEntityClass(data[0].class);
        } catch (e: any) {
          httpError(response, 400, e);
          return;
        }
        options.class = EntityClass;
        options.source = 'client';
        options.skipAc = false;
        selectors = classNamesToEntityConstructors(
          response.locals.nymph,
          selectors
        );
        let result:
          | EntityInterface
          | EntityInterface[]
          | string
          | string[]
          | number
          | null;
        try {
          if (action === 'entity') {
            result = await response.locals.nymph.getEntity(
              options,
              ...selectors
            );
          } else {
            result = await response.locals.nymph.getEntities(
              options,
              ...selectors
            );
          }
        } catch (e: any) {
          httpError(response, 500, e);
          return;
        }
        if (result == null || (Array.isArray(result) && result.length === 0)) {
          if (
            action === 'entity' ||
            response.locals.nymph.config.emptyListError
          ) {
            httpError(response, 404);
            return;
          }
        }
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(result));
      } else {
        if (typeof data !== 'string') {
          httpError(response, 400);
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.READ_ACCESS
            )
          ) {
            httpError(response, 403);
            return;
          }
        }
        let result: number | null;
        try {
          result = await response.locals.nymph.getUID(data);
        } catch (e: any) {
          httpError(response, 500, e);
          return;
        }
        if (result === null) {
          httpError(response, 404);
          return;
        } else if (typeof result !== 'number') {
          httpError(response, 500);
          return;
        }
        response.setHeader('Content-Type', 'text/plain');
        response.send(`${result}`);
      }
    } catch (e: any) {
      httpError(response, 500, e);
      return;
    }
  });

  rest.post('/', async (request, response: NymphResponse) => {
    try {
      const { action, data: dataConst } = getActionData(request);
      let data = dataConst;
      if (['entity', 'entities', 'uid', 'method'].indexOf(action) === -1) {
        httpError(response, 400);
        return;
      }
      if (['entity', 'entities'].indexOf(action) !== -1) {
        if (action === 'entity') {
          data = [data];
        }
        const created = [];
        let hadSuccess = false;
        let invalidRequest = false;
        let conflict = false;
        let notfound = false;
        let lastException = null;
        for (let entData of data) {
          if (entData.guid) {
            invalidRequest = true;
            created.push(null);
            continue;
          }
          let entity: EntityInterface;
          try {
            entity = await loadEntity(entData, response.locals.nymph);
          } catch (e: any) {
            if (e instanceof EntityConflictError) {
              conflict = true;
            } else if (e.message === NOT_FOUND_ERROR) {
              notfound = true;
            } else if (e instanceof InvalidParametersError) {
              invalidRequest = true;
              lastException = e;
            } else {
              lastException = e;
            }
            created.push(null);
            continue;
          }
          if (!entity) {
            invalidRequest = true;
            created.push(null);
            continue;
          }
          try {
            if (await entity.$save()) {
              created.push(entity);
              hadSuccess = true;
            } else {
              created.push(false);
            }
          } catch (e: any) {
            if (e instanceof EntityInvalidDataError) {
              invalidRequest = true;
            } else {
              lastException = e;
            }
            created.push(null);
          }
        }
        if (!hadSuccess) {
          if (invalidRequest) {
            httpError(response, 400, lastException);
            return;
          } else if (conflict) {
            httpError(response, 409);
            return;
          } else if (notfound) {
            httpError(response, 404);
            return;
          } else {
            httpError(response, 500, lastException);
            return;
          }
        }
        response.status(201);
        response.setHeader('Content-Type', 'application/json');
        if (action === 'entity') {
          response.send(JSON.stringify(created[0]));
        } else {
          response.send(created);
        }
      } else if (action === 'method') {
        if (!Array.isArray(data.params)) {
          httpError(response, 400);
          return;
        }
        const params = referencesToEntities(
          [...data.params],
          response.locals.nymph
        );
        if (data.static) {
          let EntityClass: EntityConstructor;
          try {
            EntityClass = response.locals.nymph.getEntityClass(data.class);
          } catch (e: any) {
            httpError(response, 400);
            return;
          }
          if (
            EntityClass.clientEnabledStaticMethods.indexOf(data.method) === -1
          ) {
            httpError(response, 403);
            return;
          }
          if (!(data.method in EntityClass)) {
            httpError(response, 400);
            return;
          }
          // @ts-ignore Dynamic methods make TypeScript sad.
          const method: Function = EntityClass[data.method];
          if (typeof method !== 'function') {
            httpError(response, 400);
            return;
          }
          try {
            const result = method.call(EntityClass, ...params);
            let ret = result;
            if (result instanceof Promise) {
              ret = await result;
            }
            response.status(200);
            response.setHeader('Content-Type', 'application/json');
            response.send({ return: ret });
          } catch (e: any) {
            httpError(response, 500, e);
            return;
          }
        } else {
          let entity: EntityInterface;
          try {
            entity = await loadEntity(data.entity, response.locals.nymph);
          } catch (e: any) {
            if (e instanceof EntityConflictError) {
              httpError(response, 409);
            } else if (e.message === NOT_FOUND_ERROR) {
              httpError(response, 404, e);
            } else if (e instanceof InvalidParametersError) {
              httpError(response, 400, e);
            } else {
              httpError(response, 500, e);
            }
            return;
          }
          if (data.entity.guid && !entity.guid) {
            httpError(response, 400);
            return;
          }
          if (entity.$getClientEnabledMethods().indexOf(data.method) === -1) {
            httpError(response, 403);
            return;
          }
          if (
            !(data.method in entity) ||
            typeof entity[data.method] !== 'function'
          ) {
            httpError(response, 400);
            return;
          }
          try {
            const result = entity[data.method](...params);
            let ret = result;
            if (result instanceof Promise) {
              ret = await result;
            }
            response.status(200);
            response.setHeader('Content-Type', 'application/json');
            if (data.stateless) {
              response.send({ return: ret });
            } else {
              response.send({ entity: entity, return: ret });
            }
          } catch (e: any) {
            httpError(response, 500, e);
            return;
          }
        }
      } else {
        if (typeof data !== 'string') {
          httpError(response, 400);
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.WRITE_ACCESS
            )
          ) {
            httpError(response, 403);
            return;
          }
        }
        let result: number | null;
        try {
          result = await response.locals.nymph.newUID(data);
        } catch (e: any) {
          httpError(response, 500, e);
          return;
        }
        if (typeof result !== 'number') {
          httpError(response, 500);
          return;
        }
        response.status(201);
        response.setHeader('Content-Type', 'text/plain');
        response.send(`${result}`);
      }
    } catch (e: any) {
      httpError(response, 500, e);
      return;
    }
  });

  rest.put('/', async (request, response: NymphResponse) => {
    try {
      const { action, data } = getActionData(request);
      if (['entity', 'entities', 'uid'].indexOf(action) === -1) {
        httpError(response, 400);
        return;
      }
      await doPutOrPatch(response, action, data, false);
    } catch (e: any) {
      httpError(response, 500, e);
      return;
    }
  });

  rest.patch('/', async (request, response: NymphResponse) => {
    try {
      const { action, data } = getActionData(request);
      if (['entity', 'entities'].indexOf(action) === -1) {
        httpError(response, 400);
        return;
      }
      await doPutOrPatch(response, action, data, true);
    } catch (e: any) {
      httpError(response, 500, e);
      return;
    }
  });

  async function doPutOrPatch(
    response: NymphResponse,
    action: string,
    data: any,
    patch: boolean
  ) {
    if (action === 'uid') {
      if (typeof data.name !== 'string' || typeof data.value !== 'number') {
        httpError(response, 400);
        return;
      }
      if (response.locals.nymph.tilmeld) {
        if (
          !response.locals.nymph.tilmeld.checkClientUIDPermissions(
            data.name,
            TilmeldAccessLevels.FULL_ACCESS
          )
        ) {
          httpError(response, 403);
          return;
        }
      }
      let result: boolean;
      try {
        result = await response.locals.nymph.setUID(data.name, data.value);
      } catch (e: any) {
        httpError(response, 500, e);
        return;
      }
      if (!result) {
        httpError(response, 500);
        return;
      }
      response.status(200);
      response.setHeader('Content-Type', 'text/plain');
      response.send(`${result}`);
    } else {
      if (action === 'entity') {
        data = [data];
      }
      const saved = [];
      let hadSuccess = false;
      let invalidRequest = false;
      let conflict = false;
      let notfound = false;
      let lastException = null;
      for (let entData of data) {
        if (entData.guid && entData.guid.length != 24) {
          invalidRequest = true;
          saved.push(null);
          continue;
        }
        let entity: EntityInterface;
        try {
          entity = await loadEntity(entData, response.locals.nymph, patch);
        } catch (e: any) {
          if (e instanceof EntityConflictError) {
            conflict = true;
          } else if (e.message === NOT_FOUND_ERROR) {
            notfound = true;
          } else if (e instanceof InvalidParametersError) {
            invalidRequest = true;
            lastException = e;
          } else {
            lastException = e;
          }
          saved.push(null);
          continue;
        }
        if (!entity) {
          invalidRequest = true;
          saved.push(null);
          continue;
        }
        try {
          if (await entity.$save()) {
            saved.push(entity);
            hadSuccess = true;
          } else {
            saved.push(false);
          }
        } catch (e: any) {
          if (e instanceof EntityInvalidDataError) {
            invalidRequest = true;
          } else {
            lastException = e;
          }
          saved.push(null);
        }
      }
      if (!hadSuccess) {
        if (invalidRequest) {
          httpError(response, 400, lastException);
        } else if (conflict) {
          httpError(response, 409);
        } else if (notfound) {
          httpError(response, 404);
        } else {
          httpError(response, 500, lastException);
        }
        return;
      }
      response.status(200);
      response.setHeader('Content-Type', 'application/json');
      if (action === 'entity') {
        response.send(JSON.stringify(saved[0]));
      } else {
        response.send(saved);
      }
    }
  }

  rest.delete('/', async (request, response: NymphResponse) => {
    try {
      const { action, data: dataConst } = getActionData(request);
      let data = dataConst;
      if (['entity', 'entities', 'uid'].indexOf(action) === -1) {
        httpError(response, 400);
        return;
      }
      if (['entity', 'entities'].indexOf(action) !== -1) {
        if (action === 'entity') {
          data = [data];
        }
        const deleted = [];
        let failures = false;
        let invalidRequest = false;
        let notfound = false;
        let lastException = null;
        for (let entData of data) {
          if (entData.guid && entData.guid.length != 24) {
            invalidRequest = true;
            continue;
          }
          let EntityClass: EntityConstructor;
          try {
            EntityClass = response.locals.nymph.getEntityClass(entData.class);
          } catch (e: any) {
            invalidRequest = true;
            failures = true;
            continue;
          }
          let entity: EntityInterface | null;
          try {
            entity = await response.locals.nymph.getEntity(
              { class: EntityClass },
              { type: '&', guid: entData.guid }
            );
          } catch (e: any) {
            lastException = e;
            failures = true;
            continue;
          }
          if (!entity) {
            notfound = true;
            failures = true;
            continue;
          }
          try {
            if (await entity.$delete()) {
              deleted.push(entData.guid);
            } else {
              failures = true;
            }
          } catch (e: any) {
            lastException = e;
            failures = true;
          }
        }
        if (deleted.length === 0) {
          if (invalidRequest || !failures) {
            httpError(response, 400, lastException);
          } else if (notfound) {
            httpError(response, 404);
          } else {
            httpError(response, 500, lastException);
          }
          return;
        }
        response.status(200);
        response.setHeader('Content-Type', 'application/json');
        if (action === 'entity') {
          response.send(JSON.stringify(deleted[0]));
        } else {
          response.send(deleted);
        }
      } else {
        if (typeof data !== 'string') {
          httpError(response, 400);
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.FULL_ACCESS
            )
          ) {
            httpError(response, 403);
            return;
          }
        }
        let result: boolean;
        try {
          result = await response.locals.nymph.deleteUID(data);
        } catch (e: any) {
          httpError(response, 500, e);
          return;
        }
        if (!result) {
          httpError(response, 500);
          return;
        }
        response.status(200);
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(result));
      }
    } catch (e: any) {
      httpError(response, 500, e);
      return;
    }
  });

  // Unauthenticate after the request.
  rest.use(unauthenticateTilmeld);

  async function loadEntity(
    entityData: EntityJson | EntityPatch,
    nymph: Nymph,
    patch = false,
    allowConflict = false
  ): Promise<EntityInterface> {
    if (entityData.class === 'Entity') {
      // Don't let clients use the `Entity` class, since it has no validity/AC checks.
      throw new InvalidParametersError(
        "Can't use Entity class directly from the front end."
      );
    }
    let EntityClass = nymph.getEntityClass(entityData.class);
    let entity: EntityInterface | null;
    if (entityData.guid) {
      entity = await nymph.getEntity(
        { class: EntityClass, source: 'client' },
        {
          type: '&',
          guid: `${entityData['guid']}`,
        }
      );
      if (entity === null) {
        throw new Error(NOT_FOUND_ERROR);
      }
    } else {
      entity = await EntityClass.factory();
    }
    if (patch) {
      entity.$jsonAcceptPatch(entityData as EntityPatch, allowConflict);
    } else {
      entity.$jsonAcceptData(entityData as EntityJson, allowConflict);
    }
    return entity;
  }

  /**
   * Check if an item is a reference, and if it is, convert it to an entity.
   *
   * This function will recurse into deeper arrays and objects.
   *
   * @param item The item to check.
   * @returns The item, converted.
   */
  function referencesToEntities(item: any, nymph: Nymph): any {
    if (Array.isArray(item)) {
      if (item.length === 3 && item[0] === 'nymph_entity_reference') {
        try {
          const EntityClass = nymph.getEntityClass(item[1]);
          return EntityClass.factoryReference(item as EntityReference);
        } catch (e: any) {
          return item;
        }
      }
      return item.map((entry) => referencesToEntities(entry, nymph));
    } else if (typeof item === 'object' && !(item instanceof Entity)) {
      // Only do this for non-entity objects.
      const newItem: { [k: string]: any } = {};
      for (let curProperty in item) {
        newItem[curProperty] = referencesToEntities(item[curProperty], nymph);
      }
      return newItem;
    }
    return item;
  }

  /**
   * Return the request with an HTTP error response.
   *
   * @param res The server response object.
   * @param defaultStatusCode The HTTP status code to use if none is given in the error object.
   * @param error An optional error object to report.
   */
  function httpError(
    res: NymphResponse,
    defaultStatusCode: number,
    error?: Error & { status?: number; statusText?: string }
  ) {
    const status = error?.status || defaultStatusCode;
    const statusText =
      error?.statusText ||
      (error?.status == null
        ? statusDescriptions[defaultStatusCode]
        : error.status in statusDescriptions &&
          statusDescriptions[error.status]) ||
      'Internal Server Error';
    if (!res.headersSent) {
      res.status(status);
      res.setHeader('Content-Type', 'application/json');
    }
    if (error) {
      res.send({
        textStatus: `${status} ${statusText}`,
        statusText,
        message: error.message,
        error,
        ...(process.env.NODE_ENV !== 'production'
          ? { stack: error.stack }
          : {}),
      });
    } else {
      res.send({
        textStatus: `${status} ${statusText}`,
        statusText,
        message: statusText,
      });
    }
  }

  return rest;
}

const statusDescriptions: { [k: number]: string } = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  103: 'Early Hints',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  306: 'Switch Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  510: 'Not Extended',
  511: 'Network Authentication Required',
};
