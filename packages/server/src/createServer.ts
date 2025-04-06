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

import { statusDescriptions } from './statusDescriptions.js';

type NymphResponse = Response<any, { nymph: Nymph }>;

const NOT_FOUND_ERROR = 'Entity is not found.';

export class ForbiddenClassError extends Error {
  constructor(message: string) {
    super(message);

    this.name = 'ForbiddenClassError';
  }
}

/**
 * A REST server middleware creator for Nymph.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export function createServer(
  nymph: Nymph,
  { jsonOptions = {} }: { jsonOptions?: OptionsJson } = {},
) {
  const rest = express();
  rest.use(cookieParser());
  rest.use(express.json(jsonOptions || {}));

  function instantiateNymph(
    _request: Request,
    response: NymphResponse,
    next: NextFunction,
  ) {
    response.locals.nymph = nymph.clone();
    next();
  }

  async function authenticateTilmeld(
    request: Request,
    response: NymphResponse,
    next: NextFunction,
  ) {
    if (response.locals.nymph.tilmeld) {
      response.locals.nymph.tilmeld.request = request;
      response.locals.nymph.tilmeld.response = response;
      try {
        await response.locals.nymph.tilmeld.authenticate(
          false,
          request.header('x-tilmeld-token-renewal') === 'off',
        );
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
    next: NextFunction,
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
          if (!EntityClass.restEnabled) {
            httpError(response, 403);
            return;
          }
        } catch (e: any) {
          httpError(response, 400, e);
          return;
        }
        options.class = EntityClass;
        options.source = 'client';
        options.skipAc = false;
        if (options.return === 'object') {
          options.return = 'entity';
        }
        try {
          selectors = classNamesToEntityConstructors(
            response.locals.nymph,
            selectors,
            true,
          );
        } catch (e: any) {
          if (e?.message === 'Not accessible.') {
            httpError(response, 403);
            return;
          } else {
            httpError(response, 500, e);
            return;
          }
        }
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
              ...selectors,
            );
          } else {
            result = await response.locals.nymph.getEntities(
              options,
              ...selectors,
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
            !(await response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.READ_ACCESS,
            ))
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
        let forbidden = false;
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
            } else if (e instanceof ForbiddenClassError) {
              forbidden = true;
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
          } else if (forbidden) {
            httpError(response, 403);
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
        try {
          const params = referencesToEntities(
            [...data.params],
            response.locals.nymph,
          );
          if (data.static) {
            let EntityClass: EntityConstructor;
            try {
              EntityClass = response.locals.nymph.getEntityClass(data.class);
              if (!EntityClass.restEnabled) {
                httpError(response, 403);
                return;
              }
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
            if (data.iterator) {
              // Ping every 15 seconds to keep connection alive.
              const interval = setInterval(() => {
                if (response.headersSent) {
                  response.write('event: ping\n');
                  response.write(`data: ${new Date().toISOString()}\n\n`);
                }
              }, 15000);

              try {
                response.set({
                  'Cache-Control': 'no-cache',
                  'Content-Type': 'text/event-stream',
                  Connection: 'keep-alive',
                });
                response.flushHeaders();

                const result:
                  | Iterator<any, any, boolean>
                  | AsyncIterator<any, any, boolean> = method.call(
                  EntityClass,
                  ...params,
                );
                let sequence = result;
                if (result instanceof Promise) {
                  sequence = await result;
                }

                let { value, done } = await sequence.next(response.destroyed);
                while (!done) {
                  response.write('event: next\n');
                  response.write(`data: ${JSON.stringify(value)}\n\n`);

                  ({ value, done } = await sequence.next(response.destroyed));
                }

                clearInterval(interval);

                response.write('event: finished\n');
                response.write('data: \n\n');
                response.end();
              } catch (e: any) {
                clearInterval(interval);
                eventStreamError(response, 500, e);
                return;
              }
            } else {
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
            }
          } else {
            let entity: EntityInterface;
            try {
              entity = await loadEntity(data.entity, response.locals.nymph);
            } catch (e: any) {
              if (e instanceof EntityConflictError) {
                httpError(response, 409);
              } else if (e instanceof ForbiddenClassError) {
                httpError(response, 403);
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
        } catch (e: any) {
          if (e instanceof ForbiddenClassError) {
            httpError(response, 403);
            return;
          } else {
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
            !(await response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.WRITE_ACCESS,
            ))
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
    patch: boolean,
  ) {
    if (action === 'uid') {
      if (typeof data.name !== 'string' || typeof data.value !== 'number') {
        httpError(response, 400);
        return;
      }
      if (response.locals.nymph.tilmeld) {
        if (
          !(await response.locals.nymph.tilmeld.checkClientUIDPermissions(
            data.name,
            TilmeldAccessLevels.FULL_ACCESS,
          ))
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
      let forbidden = false;
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
          } else if (e instanceof ForbiddenClassError) {
            forbidden = true;
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
        } else if (forbidden) {
          httpError(response, 403);
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
            if (!EntityClass.restEnabled) {
              httpError(response, 403);
              return;
            }
          } catch (e: any) {
            invalidRequest = true;
            failures = true;
            continue;
          }
          let entity: EntityInterface | null;
          try {
            entity = await response.locals.nymph.getEntity(
              { class: EntityClass },
              { type: '&', guid: entData.guid },
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
            !(await response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.FULL_ACCESS,
            ))
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
    allowConflict = false,
  ): Promise<EntityInterface> {
    if (entityData.class === 'Entity') {
      // Don't let clients use the `Entity` class, since it has no validity/AC checks.
      throw new InvalidParametersError(
        "Can't use Entity class directly from the front end.",
      );
    }
    let EntityClass = nymph.getEntityClass(entityData.class);
    if (!EntityClass.restEnabled) {
      throw new ForbiddenClassError('Not accessible.');
    }
    let entity: EntityInterface | null;
    if (entityData.guid) {
      entity = await nymph.getEntity(
        { class: EntityClass, source: 'client' },
        {
          type: '&',
          guid: `${entityData['guid']}`,
        },
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
    if (item == null) {
      return item;
    } else if (Array.isArray(item)) {
      if (item.length === 3 && item[0] === 'nymph_entity_reference') {
        try {
          const EntityClass = nymph.getEntityClass(item[1]);
          if (!EntityClass.restEnabled) {
            throw new ForbiddenClassError('Not accessible.');
          }
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
    error?: Error & { status?: number; statusText?: string },
  ) {
    const status = error?.status || defaultStatusCode;
    const statusText =
      error?.statusText ||
      (error?.status == null
        ? statusDescriptions[defaultStatusCode]
        : error.status in statusDescriptions &&
          statusDescriptions[error.status]) ||
      'Internal Server Error';

    const errorResponse = error
      ? {
          textStatus: `${status} ${statusText}`,
          statusText,
          message: error.message,
          error,
          ...(process.env.NODE_ENV !== 'production'
            ? { stack: error.stack }
            : {}),
        }
      : {
          textStatus: `${status} ${statusText}`,
          statusText,
          message: statusText,
        };

    if (!res.headersSent) {
      res.status(status);
      res.setHeader('Content-Type', 'application/json');
    }

    res.send(errorResponse);
  }

  /**
   * End the event stream with an HTTP error response.
   *
   * @param res The server response object.
   * @param defaultStatusCode The HTTP status code to use if none is given in the error object.
   * @param error An optional error object to report.
   */
  function eventStreamError(
    res: NymphResponse,
    defaultStatusCode: number,
    error?: Error & { status?: number; statusText?: string },
  ) {
    const status = error?.status || defaultStatusCode;
    const statusText =
      error?.statusText ||
      (error?.status == null
        ? statusDescriptions[defaultStatusCode]
        : error.status in statusDescriptions &&
          statusDescriptions[error.status]) ||
      'Internal Server Error';

    const errorResponse = error
      ? {
          status,
          textStatus: `${status} ${statusText}`,
          statusText,
          message: error.message,
          error,
          ...(process.env.NODE_ENV !== 'production'
            ? { stack: error.stack }
            : {}),
        }
      : {
          status,
          textStatus: `${status} ${statusText}`,
          statusText,
          message: statusText,
        };

    if (!res.headersSent) {
      res.status(status);
      res.setHeader('Content-Type', 'application/json');

      res.send(errorResponse);
    } else {
      res.write('event: error\n');
      res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);

      res.write('event: finished\n');
      res.write('data: \n\n');
      res.end();
    }
  }

  return rest;
}
