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
        httpError(response, 500, 'Internal Server Error', e);
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
        httpError(response, 500, 'Internal Server Error', e);
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
        httpError(response, 400, 'Bad Request');
        return;
      }
      if (['entity', 'entities'].indexOf(action) !== -1) {
        if (!Array.isArray(data)) {
          httpError(response, 400, 'Bad Request');
          return;
        }
        const count = data.length;
        if (count < 1 || typeof data[0] !== 'object') {
          httpError(response, 400, 'Bad Request');
          return;
        }
        if (!('class' in data[0])) {
          httpError(response, 400, 'Bad Request');
          return;
        }
        let [options, ...selectors] = data as [Options, ...Selector[]];
        let EntityClass;
        try {
          EntityClass = response.locals.nymph.getEntityClass(data[0].class);
        } catch (e: any) {
          httpError(response, 400, 'Bad Request', e);
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
          httpError(response, 500, 'Internal Server Error', e);
          return;
        }
        if (result == null || (Array.isArray(result) && result.length === 0)) {
          if (
            action === 'entity' ||
            response.locals.nymph.config.emptyListError
          ) {
            httpError(response, 404, 'Not Found');
            return;
          }
        }
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(result));
      } else {
        if (typeof data !== 'string') {
          httpError(response, 400, 'Bad Request');
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.READ_ACCESS
            )
          ) {
            httpError(response, 403, 'Forbidden');
            return;
          }
        }
        let result: number | null;
        try {
          result = await response.locals.nymph.getUID(data);
        } catch (e: any) {
          httpError(response, 500, 'Internal Server Error', e);
          return;
        }
        if (result === null) {
          httpError(response, 404, 'Not Found');
          return;
        } else if (typeof result !== 'number') {
          httpError(response, 500, 'Internal Server Error');
          return;
        }
        response.setHeader('Content-Type', 'text/plain');
        response.send(`${result}`);
      }
    } catch (e: any) {
      httpError(response, 500, 'Internal Server Error', e);
      return;
    }
  });

  rest.post('/', async (request, response: NymphResponse) => {
    try {
      const { action, data: dataConst } = getActionData(request);
      let data = dataConst;
      if (['entity', 'entities', 'uid', 'method'].indexOf(action) === -1) {
        httpError(response, 400, 'Bad Request');
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
            httpError(response, 400, 'Bad Request', lastException);
            return;
          } else if (conflict) {
            httpError(response, 409, 'Conflict');
            return;
          } else if (notfound) {
            httpError(response, 404, 'Not Found');
            return;
          } else {
            httpError(response, 500, 'Internal Server Error', lastException);
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
          httpError(response, 400, 'Bad Request');
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
            httpError(response, 400, 'Bad Request');
            return;
          }
          if (
            EntityClass.clientEnabledStaticMethods.indexOf(data.method) === -1
          ) {
            httpError(response, 403, 'Forbidden');
            return;
          }
          if (!(data.method in EntityClass)) {
            httpError(response, 400, 'Bad Request');
            return;
          }
          // @ts-ignore Dynamic methods make TypeScript sad.
          const method: Function = EntityClass[data.method];
          if (typeof method !== 'function') {
            httpError(response, 400, 'Bad Request');
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
            httpError(response, 500, 'Internal Server Error', e);
            return;
          }
        } else {
          let entity: EntityInterface;
          try {
            entity = await loadEntity(data.entity, response.locals.nymph);
          } catch (e: any) {
            if (e instanceof EntityConflictError) {
              httpError(response, 409, 'Conflict');
            } else if (e.message === NOT_FOUND_ERROR) {
              httpError(response, 404, 'Not Found', e);
            } else if (e instanceof InvalidParametersError) {
              httpError(response, 400, 'Bad Request', e);
            } else {
              httpError(response, 500, 'Internal Server Error', e);
            }
            return;
          }
          if (data.entity.guid && !entity.guid) {
            httpError(response, 400, 'Bad Request');
            return;
          }
          if (entity.$getClientEnabledMethods().indexOf(data.method) === -1) {
            httpError(response, 403, 'Forbidden');
            return;
          }
          if (
            !(data.method in entity) ||
            typeof entity[data.method] !== 'function'
          ) {
            httpError(response, 400, 'Bad Request');
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
            httpError(response, 500, 'Internal Server Error', e);
            return;
          }
        }
      } else {
        if (typeof data !== 'string') {
          httpError(response, 400, 'Bad Request');
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.WRITE_ACCESS
            )
          ) {
            httpError(response, 403, 'Forbidden');
            return;
          }
        }
        let result: number | null;
        try {
          result = await response.locals.nymph.newUID(data);
        } catch (e: any) {
          httpError(response, 500, 'Internal Server Error', e);
          return;
        }
        if (typeof result !== 'number') {
          httpError(response, 500, 'Internal Server Error');
          return;
        }
        response.status(201);
        response.setHeader('Content-Type', 'text/plain');
        response.send(`${result}`);
      }
    } catch (e: any) {
      httpError(response, 500, 'Internal Server Error', e);
      return;
    }
  });

  rest.put('/', async (request, response: NymphResponse) => {
    try {
      const { action, data } = getActionData(request);
      if (['entity', 'entities', 'uid'].indexOf(action) === -1) {
        httpError(response, 400, 'Bad Request');
        return;
      }
      await doPutOrPatch(response, action, data, false);
    } catch (e: any) {
      httpError(response, 500, 'Internal Server Error', e);
      return;
    }
  });

  rest.patch('/', async (request, response: NymphResponse) => {
    try {
      const { action, data } = getActionData(request);
      if (['entity', 'entities'].indexOf(action) === -1) {
        httpError(response, 400, 'Bad Request');
        return;
      }
      await doPutOrPatch(response, action, data, true);
    } catch (e: any) {
      httpError(response, 500, 'Internal Server Error', e);
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
        httpError(response, 400, 'Bad Request');
        return;
      }
      if (response.locals.nymph.tilmeld) {
        if (
          !response.locals.nymph.tilmeld.checkClientUIDPermissions(
            data.name,
            TilmeldAccessLevels.FULL_ACCESS
          )
        ) {
          httpError(response, 403, 'Forbidden');
          return;
        }
      }
      let result: boolean;
      try {
        result = await response.locals.nymph.setUID(data.name, data.value);
      } catch (e: any) {
        httpError(response, 500, 'Internal Server Error', e);
        return;
      }
      if (!result) {
        httpError(response, 500, 'Internal Server Error');
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
          httpError(response, 400, 'Bad Request', lastException);
        } else if (conflict) {
          httpError(response, 409, 'Conflict');
        } else if (notfound) {
          httpError(response, 404, 'Not Found');
        } else {
          httpError(response, 500, 'Internal Server Error', lastException);
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
        httpError(response, 400, 'Bad Request');
        return;
      }
      if (['entity', 'entities'].indexOf(action) !== -1) {
        if (action === 'entity') {
          data = [data];
        }
        const deleted = [];
        let failures = false;
        let hadSuccess = false;
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
              hadSuccess = true;
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
            httpError(response, 400, 'Bad Request', lastException);
          } else if (notfound) {
            httpError(response, 404, 'Not Found');
          } else {
            httpError(response, 500, 'Internal Server Error', lastException);
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
          httpError(response, 400, 'Bad Request');
          return;
        }
        if (response.locals.nymph.tilmeld) {
          if (
            !response.locals.nymph.tilmeld.checkClientUIDPermissions(
              data,
              TilmeldAccessLevels.FULL_ACCESS
            )
          ) {
            httpError(response, 403, 'Forbidden');
            return;
          }
        }
        let result: boolean;
        try {
          result = await response.locals.nymph.deleteUID(data);
        } catch (e: any) {
          httpError(response, 500, 'Internal Server Error', e);
          return;
        }
        if (!result) {
          httpError(response, 500, 'Internal Server Error');
          return;
        }
        response.status(200);
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(result));
      }
    } catch (e: any) {
      httpError(response, 500, 'Internal Server Error', e);
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
   * @param errorCode The HTTP status code.
   * @param message The message to place on the HTTP status header line.
   * @param error An optional exception object to report.
   */
  function httpError(
    res: NymphResponse,
    errorCode: number,
    message: string,
    error?: Error
  ) {
    if (!res.headersSent) {
      res.status(errorCode);
      res.setHeader('Content-Type', 'application/json');
    }
    if (error) {
      res.send({
        textStatus: `${errorCode} ${message}`,
        message: error.message,
        error,
        ...(process.env.NODE_ENV !== 'production'
          ? { stack: error.stack }
          : {}),
      });
    } else {
      res.send({ textStatus: `${errorCode} ${message}` });
    }
  }

  return rest;
}
