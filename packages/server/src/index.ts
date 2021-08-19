import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
// import safeJsonStringify from 'safe-json-stringify';
import Nymph, {
  Entity,
  EntityConflictError,
  EntityConstructor,
  EntityInterface,
  EntityJson,
  EntityPatch,
  EntityReference,
  InvalidParametersError,
} from '@nymphjs/nymph';

const rest = express();
rest.use(cookieParser());
rest.use(express.json());

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

rest.get('/', async (request, response) => {
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
      EntityClass = Nymph.getEntityClass(data[0].class);
    } catch (e) {
      httpError(response, 400, 'Bad Request', e);
      return;
    }
    data[0].class = EntityClass;
    data[0].source = 'client';
    data[0].skipAc = false;
    let result: EntityInterface | EntityInterface[] | string | string[] | null;
    try {
      if (action === 'entity') {
        result = await Nymph.getEntity(data[0], ...data.slice(1));
      } else {
        result = await Nymph.getEntities(...data);
      }
    } catch (e) {
      httpError(response, 500, 'Internal Server Error', e);
      return;
    }
    if (result === [] || result == null) {
      if (action === 'entity' || Nymph.config.emptyListError) {
        httpError(response, 404, 'Not Found');
        return;
      }
    }
    response.setHeader('Content-Type', 'application/json');
    response.send(JSON.stringify(result));
  } else {
    let result: number | null;
    try {
      result = await Nymph.getUID(`${data}`);
    } catch ($e) {
      httpError(response, 500, 'Internal Server Error', $e);
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
});

rest.post('/', async (request, response) => {
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
    let invalidData = false;
    let conflict = false;
    let lastException = null;
    for (let entData of data) {
      if (entData.guid) {
        invalidData = true;
        created.push(null);
        continue;
      }
      let entity: EntityInterface;
      try {
        entity = await loadEntity(entData);
      } catch (e) {
        if (e instanceof EntityConflictError) {
          conflict = true;
        }
        created.push(null);
        continue;
      }
      if (!entity) {
        invalidData = true;
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
      } catch (e) {
        if (e instanceof InvalidParametersError) {
          invalidData = true;
        } else {
          lastException = e;
        }
        created.push(null);
      }
    }
    if (!hadSuccess) {
      if (invalidData) {
        httpError(response, 400, 'Bad Request');
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
    data.params = referenceToEntity(data.params);
    if (data.static) {
      let EntityClass: EntityConstructor;
      try {
        EntityClass = Nymph.getEntityClass(data.class);
      } catch (e) {
        httpError(response, 400, 'Bad Request');
        return;
      }
      if (EntityClass.clientEnabledStaticMethods.indexOf(data.method) === -1) {
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
        const ret = method.call(EntityClass, ...data.params);
        response.status(200);
        response.setHeader('Content-Type', 'application/json');
        response.send({ return: ret });
      } catch ($e) {
        httpError(response, 500, 'Internal Server Error', $e);
        return;
      }
    } else {
      let entity: EntityInterface;
      try {
        entity = await loadEntity(data.entity);
      } catch (e) {
        if (e instanceof EntityConflictError) {
          httpError(response, 409, 'Conflict');
        } else {
          httpError(response, 500, 'Internal Server Error');
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
        const ret = entity[data.method](...data.params);
        response.status(200);
        response.setHeader('Content-Type', 'application/json');
        if (data.stateless) {
          response.send({ return: ret });
        } else {
          response.send({ entity: entity, return: ret });
        }
      } catch (e) {
        httpError(response, 500, 'Internal Server Error', e);
        return;
      }
    }
  } else {
    let result: number | null;
    try {
      result = await Nymph.newUID(`${data}`);
    } catch (e) {
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
});

rest.put('/', async (request, response) => {
  const { action, data } = getActionData(request);
  if (['entity', 'entities', 'uid'].indexOf(action) === -1) {
    httpError(response, 400, 'Bad Request');
    return;
  }
  await doPutOrPatch(response, action, data, false);
});

rest.patch('/', async (request, response) => {
  const { action, data } = getActionData(request);
  if (['entity', 'entities'].indexOf(action) === -1) {
    httpError(response, 400, 'Bad Request');
    return;
  }
  await doPutOrPatch(response, action, data, true);
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
      result = await Nymph.setUID(data.name, data.value);
    } catch ($e) {
      httpError(response, 500, 'Internal Server Error', $e);
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
    let invalidData = false;
    let conflict = false;
    let notfound = false;
    let lastException = null;
    for (let entData of data) {
      if (entData.guid && entData.guid.length != 24) {
        invalidData = true;
        saved.push(null);
        continue;
      }
      let entity: EntityInterface;
      try {
        entity = await loadEntity(entData, patch);
      } catch (e) {
        if (e instanceof EntityConflictError) {
          conflict = true;
        }
        saved.push(null);
        continue;
      }
      if (!entity) {
        invalidData = true;
        saved.push(null);
        continue;
      }
      try {
        if (entity.$save()) {
          saved.push(entity);
          hadSuccess = true;
        } else {
          saved.push(false);
        }
      } catch (e) {
        if (e instanceof InvalidParametersError) {
          invalidData = true;
        } else {
          lastException = e;
        }
        saved.push(null);
      }
    }
    if (!hadSuccess) {
      if (invalidData) {
        httpError(response, 400, 'Bad Request');
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
    let invalidData = false;
    for (let delEnt of data) {
      try {
        const guid = delEnt.guid;
        if (!delEnt.guid) {
          invalidData = true;
          continue;
        }
        if (await Nymph.deleteEntityByID(guid, delEnt.class)) {
          deleted.push(guid);
        } else {
          failures = true;
        }
      } catch (e) {
        failures = true;
      }
    }
    if (deleted.length === 0) {
      if (invalidData || !failures) {
        httpError(response, 400, 'Bad Request');
      } else {
        httpError(response, 500, 'Internal Server Error');
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
    if (!(await Nymph.deleteUID(`${data}`))) {
      httpError(response, 500, 'Internal Server Error');
      return;
    }
    response.status(204);
  }
  return true;
});

async function loadEntity(
  entityData: EntityJson | EntityPatch,
  patch = false,
  allowConflict = false
): Promise<EntityInterface> {
  if (entityData.class === 'Entity') {
    // Don't let clients use the `Entity` class, since it has no validity/AC checks.
    throw new Error("Can't use Entity class directly from the front end.");
  }
  let EntityClass: EntityConstructor;
  try {
    EntityClass = Nymph.getEntityClass(entityData.class);
  } catch (e) {
    throw e;
  }
  let entity: EntityInterface | null;
  if (entityData.guid) {
    entity = await Nymph.getEntity(
      { class: EntityClass },
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
 * This function will recurse into deeper arrays.
 *
 * @param item The item to check.
 * @returns The item, converted.
 */
function referenceToEntity(item: any): any {
  if (Array.isArray(item)) {
    if (item.length === 3 && item[0] === 'nymph_entity_reference') {
      try {
        const EntityClass = Nymph.getEntityClass(item[1]);
        return EntityClass.factoryReference(item as EntityReference);
      } catch (e) {
        return item;
      }
    } else {
      return item.map((entry) => referenceToEntity(item));
    }
  } else if (typeof item === 'object' && !(item instanceof Entity)) {
    // Only do this for non-entity objects.
    for (let curProperty in item) {
      item[curProperty] = referenceToEntity(curProperty);
    }
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
  if (res.headersSent) {
    return;
  }
  res.status(500);
  res.setHeader('Content-Type', 'application/json');
  if (error) {
    res.send({
      textStatus: `${errorCode} ${message}`,
      exception: error.constructor.name,
      message: error.message,
    });
  } else {
    res.send({ textStatus: `${errorCode} ${message}` });
  }
}

export default rest;

// rest.get('/', function (req, res) {
//   res.cookie('my-cookie', 'value', {
//     domain: 'localhost',
//     maxAge: 1000 * 60,
//     httpOnly: true,
//     path: '/',
//   });
//   res.send(`<pre>${safeJsonStringify(req.headers, null, 2)}
// ${safeJsonStringify(req.query, null, 2)}
// ${safeJsonStringify(req.body, null, 2)}
// ${safeJsonStringify(req.cookies, null, 2)}

// ${safeJsonStringify(req, null, 2)}</pre>`);
// });

// /**
//  * Simple Nymph REST server implementation.
//  *
//  * Provides Nymph functionality compatible with a REST API. Allows the developer
//  * to design their own API, or just use the reference implementation.
//  *
//  * @author Hunter Perrin <hperrin@gmail.com>
//  * @copyright SciActive.com
//  * @see http://nymph.io/
//  */
// class REST {
//   /**
//    * Run the Nymph REST server process.
//    *
//    * Note that on failure, an HTTP error status code will be sent, usually
//    * along with a message body.
//    *
//    * @param string $method The HTTP method.
//    * @param string $action The Nymph action.
//    * @param string $data The decoded data.
//    * @return bool True on success, false on failure.
//    */
//   run($method, $action, $data) {
//     $method = strtoupper($method);
//     if (is_callable([$this, $method])) {
//       return $this->$method($action, $data);
//     }
//     return $this->httpError(405, 'Method Not Allowed');
//   }
// }
