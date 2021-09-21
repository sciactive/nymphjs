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
} from '@nymphjs/nymph';
import { EntityInvalidDataError } from '@nymphjs/nymph';

export default function createServer(nymph: Nymph) {
  const rest = express();
  rest.use(cookieParser());
  rest.use(express.json());

  function authenticateTilmeld(
    request: Request,
    response: Response,
    next: NextFunction
  ) {
    if (nymph.tilmeld) {
      nymph.tilmeld.request = request;
      nymph.tilmeld.response = response;
      try {
        nymph.tilmeld.authenticate();
      } catch (e: any) {
        httpError(response, 500, 'Internal Server Error', e);
        return;
      }
    }
    next();
  }

  function unauthenticateTilmeld(
    _request: Request,
    response: Response,
    next: NextFunction
  ) {
    if (nymph.tilmeld) {
      nymph.tilmeld.request = null;
      nymph.tilmeld.response = null;
      try {
        nymph.tilmeld.clearSession();
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

  // Authenticate before the request.
  rest.use(authenticateTilmeld);

  rest.get('/', async (request, response) => {
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
        let EntityClass;
        try {
          EntityClass = nymph.getEntityClass(data[0].class);
        } catch (e: any) {
          httpError(response, 400, 'Bad Request', e);
          return;
        }
        data[0].class = EntityClass;
        data[0].source = 'client';
        data[0].skipAc = false;
        let result:
          | EntityInterface
          | EntityInterface[]
          | string
          | string[]
          | null;
        try {
          if (action === 'entity') {
            result = await nymph.getEntity(data[0], ...data.slice(1));
          } else {
            result = await nymph.getEntities(...data);
          }
        } catch (e: any) {
          httpError(response, 500, 'Internal Server Error', e);
          return;
        }
        if (result === [] || result == null) {
          if (action === 'entity' || nymph.config.emptyListError) {
            httpError(response, 404, 'Not Found');
            return;
          }
        }
        response.setHeader('Content-Type', 'application/json');
        response.send(JSON.stringify(result));
      } else {
        let result: number | null;
        try {
          result = await nymph.getUID(`${data}`);
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

  rest.post('/', async (request, response) => {
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
        let lastException = null;
        for (let entData of data) {
          if (entData.guid) {
            invalidRequest = true;
            created.push(null);
            continue;
          }
          let entity: EntityInterface;
          try {
            entity = await loadEntity(entData);
          } catch (e: any) {
            if (e instanceof EntityConflictError) {
              conflict = true;
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
        const params = referencesToEntities([...data.params]);
        if (data.static) {
          let EntityClass: EntityConstructor;
          try {
            EntityClass = nymph.getEntityClass(data.class);
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
            entity = await loadEntity(data.entity);
          } catch (e: any) {
            if (e instanceof EntityConflictError) {
              httpError(response, 409, 'Conflict');
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
        let result: number | null;
        try {
          result = await nymph.newUID(`${data}`);
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

  rest.put('/', async (request, response) => {
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

  rest.patch('/', async (request, response) => {
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
    response: Response,
    action: string,
    data: any,
    patch: boolean
  ) {
    if (action === 'uid') {
      if (typeof data.name !== 'string' || typeof data.value !== 'number') {
        httpError(response, 400, 'Bad Request');
        return;
      }
      let result: boolean;
      try {
        result = await nymph.setUID(data.name, data.value);
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
          entity = await loadEntity(entData, patch);
        } catch (e: any) {
          if (e instanceof EntityConflictError) {
            conflict = true;
          }
          if (e instanceof InvalidParametersError) {
            invalidRequest = true;
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

  rest.delete('/', async (request, response) => {
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
        let invalidRequest = false;
        let lastException = null;
        for (let delEnt of data) {
          try {
            const guid = delEnt.guid;
            if (!delEnt.guid) {
              invalidRequest = true;
              continue;
            }
            if (await nymph.deleteEntityByID(guid, delEnt.class)) {
              deleted.push(guid);
            } else {
              failures = true;
            }
          } catch (e: any) {
            failures = true;
            lastException = e;
          }
        }
        if (deleted.length === 0) {
          if (invalidRequest || !failures) {
            httpError(response, 400, 'Bad Request');
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
        let result: boolean;
        try {
          result = await nymph.deleteUID(data);
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
        throw new Error('Entity is not found.');
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
  function referencesToEntities(item: any): any {
    if (Array.isArray(item)) {
      if (item.length === 3 && item[0] === 'nymph_entity_reference') {
        try {
          const EntityClass = nymph.getEntityClass(item[1]);
          return EntityClass.factoryReference(item as EntityReference);
        } catch (e: any) {
          return item;
        }
      }
      return item.map((entry) => referencesToEntities(entry));
    } else if (typeof item === 'object' && !(item instanceof Entity)) {
      // Only do this for non-entity objects.
      const newItem: { [k: string]: any } = {};
      for (let curProperty in item) {
        newItem[curProperty] = referencesToEntities(item[curProperty]);
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
    res: Response,
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
