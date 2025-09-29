import type { EntityConstructor, Options, Selector } from '@nymphjs/client';
import { splitn } from '@sciactive/splitn';

export type BareQueryHandler = (
  input: string,
  entityClass?: EntityConstructor,
  defaultFields?: string[],
) => Partial<Selector>;

export type QRefMap = {
  [k: string]: { class: EntityConstructor; defaultFields?: string[] };
};

export default function queryParser<
  T extends EntityConstructor = EntityConstructor,
>({
  query,
  entityClass,
  defaultFields = ['name'],
  qrefMap = {},
  bareHandler = (input, _class, defaultFields = ['name']) => {
    if (!input.match(/[_%]/)) {
      input = `%${input}%`;
    }
    if (defaultFields.length) {
      return {
        type: '|',
        ilike: defaultFields.map((field) => [field, input]) as [
          string,
          string,
        ][],
      };
    }
    return {};
  },
}: {
  query: string;
  entityClass: T;
  defaultFields?: string[];
  qrefMap?: QRefMap;
  bareHandler?: BareQueryHandler;
}): [Options<T>, ...Selector[]] {
  const options: Options<T> = { class: entityClass };
  return [
    options,
    ...selectorsParser({
      query,
      entityClass,
      type: '&',
      defaultFields,
      qrefMap,
      options,
      bareHandler,
    }),
  ];
}

function selectorsParser({
  query,
  entityClass,
  type,
  defaultFields,
  qrefMap,
  options,
  bareHandler,
}: {
  query: string;
  entityClass: EntityConstructor;
  type: '&' | '|' | '!&' | '!|';
  defaultFields: string[];
  qrefMap: QRefMap;
  options?: Options;
  bareHandler: BareQueryHandler;
}): Selector[] {
  const selector: Selector = { type };
  let curQuery = query;

  // Look for top level selectors inside parens.
  const subSelectorPairs: [number, number][] = [];
  let inQuote = false;
  let nesting = 0;
  let currentStart: number | null = null;
  for (let i = 0; i < curQuery.length; i++) {
    if (curQuery[i] === '"') {
      if (!inQuote) {
        inQuote = true;
      } else if (curQuery[i - 1] !== '\\') {
        inQuote = false;
      }
    } else if (inQuote) {
      continue;
    } else if (curQuery[i] === '(') {
      if (currentStart == null) {
        currentStart = i;
      } else {
        nesting++;
      }
    } else if (curQuery[i] === ')') {
      if (nesting === 0) {
        if (currentStart == null) {
          // mismatched parens
        } else {
          subSelectorPairs.push([currentStart, i + 1]);
          currentStart = null;
        }
      } else {
        nesting--;
      }
    }
  }

  if (subSelectorPairs.length) {
    selector.selector = [];
    // Reverse order so we can take them out back to front.
    subSelectorPairs.reverse();
    for (let pair of subSelectorPairs) {
      // Slice out in between the parens.
      let selectorQuery = curQuery.slice(pair[0] + 1, pair[1] - 1);
      // Cut the selector out of the query.
      curQuery = curQuery.slice(0, pair[0]) + curQuery.slice(pair[1]);

      // First char inside parens determines type of selector.
      let type: '&' | '|' | '!&' | '!|' = '&';
      if (selectorQuery.startsWith('&')) {
        selectorQuery = selectorQuery.slice(1);
      } else if (selectorQuery.startsWith('!&')) {
        type = '!&';
        selectorQuery = selectorQuery.slice(2);
      } else if (selectorQuery.startsWith('|')) {
        type = '|';
        selectorQuery = selectorQuery.slice(1);
      } else if (selectorQuery.startsWith('!|')) {
        type = '!|';
        selectorQuery = selectorQuery.slice(2);
      } else if (selectorQuery.startsWith('!')) {
        type = '!&';
        selectorQuery = selectorQuery.slice(1);
      }
      selector.selector.push(
        ...selectorsParser({
          query: selectorQuery,
          entityClass,
          type,
          defaultFields,
          qrefMap,
          bareHandler,
        }),
      );
    }
  }

  curQuery = selectorParser({
    query: curQuery,
    selector,
    qrefMap,
    bareHandler,
  });

  if (options) {
    const limitRegex = /(?: |^)limit:(\d+)(?= |$)/;
    const limitMatch = curQuery.match(limitRegex);
    if (limitMatch) {
      options.limit = Number(limitMatch[1]);
    }
    curQuery = curQuery.replace(limitRegex, '');

    const offsetRegex = /(?: |^)offset:(\d+)(?= |$)/;
    const offsetMatch = curQuery.match(offsetRegex);
    if (offsetMatch) {
      options.offset = Number(offsetMatch[1]);
    }
    curQuery = curQuery.replace(offsetRegex, '');

    // JavaScript variable names are ridiculously infeasable to check
    // thoroughly, so this is a "best attempt".
    const sortRegex =
      /(?: |^)sort:([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)(?= |$)/;
    const sortMatch = curQuery.match(sortRegex);
    if (sortMatch) {
      options.sort = sortMatch[1];
    }
    curQuery = curQuery.replace(sortRegex, '');

    const reverseRegex = /(?: |^)reverse:(true|false|1|0)(?= |$)/;
    const reverseMatch = curQuery.match(reverseRegex);
    if (reverseMatch) {
      options.reverse = reverseMatch[1] === 'true' || reverseMatch[1] === '1';
    }
    curQuery = curQuery.replace(reverseRegex, '');
  }

  curQuery = curQuery.trim();

  if (curQuery.length) {
    const bareSelector = bareHandler(curQuery, entityClass, defaultFields);

    if (Object.keys(bareSelector).length) {
      return [
        ...(Object.keys(selector).length > 1 ? [selector] : []),
        {
          type: '|',
          ...bareSelector,
        },
      ];
    }
  }

  if (
    'selector' in selector &&
    (selector.selector as Selector[]).length === 1 &&
    Object.keys(selector).length === 2 &&
    (selector.type === '&' || selector.type === '|')
  ) {
    // There is only one subselector, and this selector is a positive match
    // type, so just return it as the selector.
    return selector.selector as Selector[];
  }

  return [selector];
}

function selectorParser({
  query,
  selector,
  qrefMap,
  bareHandler,
}: {
  query: string;
  selector: Selector;
  qrefMap: QRefMap;
  bareHandler: BareQueryHandler;
}): string {
  let curQuery = query;

  // eg. user<{User name="Hunter"}> or user!<{User name="Hunter"}>
  const qrefRegex =
    /(?: |^)([a-zA-Z0-9-_.+~]+)!?<\{(\w+) (.*?[^\\])\}>(?= |$)/g;
  const qrefMatch = curQuery.match(qrefRegex);
  if (qrefMatch) {
    selector.qref = [];
    selector['!qref'] = [];
    for (let match of qrefMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
        value = unQuoteCurlies(value.slice(1, -1));
        let [className, qrefQuery] = splitn(value, ' ', 2);
        const EntityClass = qrefMap[className].class;
        if (EntityClass == null) {
          continue;
        }
        const qref = queryParser({
          query: qrefQuery,
          entityClass: EntityClass,
          defaultFields: qrefMap[className].defaultFields,
          qrefMap,
          bareHandler,
        });
        if (name.endsWith('!')) {
          selector['!qref'].push([name.slice(0, -1), qref]);
        } else {
          selector.qref.push([name, qref]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.qref.length) {
      delete selector.qref;
    }
    if (!selector['!qref'].length) {
      delete selector['!qref'];
    }
  }
  curQuery = curQuery.replace(qrefRegex, '');

  // eg. name=Marty or name="Marty McFly" or enabled=true or someArray=[1,2]
  const equalRegex =
    /(?: |^)([a-zA-Z0-9-_.+~]+)!?=(""|".*?[^\\]"|[^ ]+)(?= |$)/g;
  const equalMatch = curQuery.match(equalRegex);
  if (equalMatch) {
    selector.equal = [];
    selector['!equal'] = [];
    for (let match of equalMatch) {
      try {
        let [name, value] = splitn(match.trim(), '=', 2);
        try {
          if (name.endsWith('!')) {
            selector['!equal'].push([name.slice(0, -1), JSON.parse(value)]);
          } else {
            selector.equal.push([name, JSON.parse(value)]);
          }
        } catch (e: any) {
          if (name.endsWith('!')) {
            selector['!equal'].push([name.slice(0, -1), unQuoteString(value)]);
          } else {
            selector.equal.push([name, unQuoteString(value)]);
          }
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.equal.length) {
      delete selector.equal;
    }
    if (!selector['!equal'].length) {
      delete selector['!equal'];
    }
  }
  curQuery = curQuery.replace(equalRegex, '');

  // eg. user<{790274347f9b3a018c2cedee}> or user!<{790274347f9b3a018c2cedee}>
  const refRegex = /(?: |^)([a-zA-Z0-9-_.+~]+)!?<\{([0-9a-f]{24})\}>(?= |$)/g;
  const refMatch = curQuery.match(refRegex);
  if (refMatch) {
    selector.ref = [];
    selector['!ref'] = [];
    for (let match of refMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
        if (name.endsWith('!')) {
          selector['!ref'].push([name.slice(0, -1), value.slice(1, -1)]);
        } else {
          selector.ref.push([name, value.slice(1, -1)]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.ref.length) {
      delete selector.ref;
    }
    if (!selector['!ref'].length) {
      delete selector['!ref'];
    }
  }
  curQuery = curQuery.replace(refRegex, '');

  // eg. someArrayOfNumbers<10> or someObject!<"some string">
  const containRegex =
    /(?: |^)([a-zA-Z0-9-_.+~]+)!?(<(?:[^"][^>]*?|".*?[^\\]"))>(?= |$)/g;
  const containMatch = curQuery.match(containRegex);
  if (containMatch) {
    selector.contain = [];
    selector['!contain'] = [];
    for (let match of containMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
        try {
          if (name.endsWith('!')) {
            selector['!contain'].push([
              name.slice(0, -1),
              JSON.parse(unQuoteString(value)),
            ]);
          } else {
            selector.contain.push([name, JSON.parse(unQuoteString(value))]);
          }
        } catch (e: any) {
          if (name.endsWith('!')) {
            selector['!contain'].push([
              name.slice(0, -1),
              unQuoteString(value),
            ]);
          } else {
            selector.contain.push([name, unQuoteString(value)]);
          }
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.contain.length) {
      delete selector.contain;
    }
    if (!selector['!contain'].length) {
      delete selector['!contain'];
    }
  }
  curQuery = curQuery.replace(containRegex, '');

  // eg. name~/Hunter/ or name!~/hunter/i
  const posixRegex =
    /(?: |^)([a-zA-Z0-9-_.+~]+)!?~(\/\/|\/.*?[^\\]\/)i?(?= |$)/g;
  const posixMatch = curQuery.match(posixRegex);
  if (posixMatch) {
    selector.match = [];
    selector['!match'] = [];
    selector.imatch = [];
    selector['!imatch'] = [];
    for (let match of posixMatch) {
      try {
        let [name, value] = splitn(match.trim(), '~', 2);
        if (name.endsWith('!')) {
          if (value.endsWith('i')) {
            selector['!imatch'].push([
              name.slice(0, -1),
              value.replace(/^\/|\/i$/g, ''),
            ]);
          } else {
            selector['!match'].push([
              name.slice(0, -1),
              value.replace(/^\/|\/$/g, ''),
            ]);
          }
        } else {
          if (value.endsWith('i')) {
            selector.imatch.push([name, value.replace(/^\/|\/i$/g, '')]);
          } else {
            selector.match.push([name, value.replace(/^\/|\/$/g, '')]);
          }
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.match.length) {
      delete selector.match;
    }
    if (!selector['!match'].length) {
      delete selector['!match'];
    }
    if (!selector.imatch.length) {
      delete selector.imatch;
    }
    if (!selector['!imatch'].length) {
      delete selector['!imatch'];
    }
  }
  curQuery = curQuery.replace(posixRegex, '');

  // eg. name~Hunter or name!~"hunter"i
  const likeRegex =
    /(?: |^)([a-zA-Z0-9-_.+~]+)!?~(""i?|".*?[^\\]"i?|[^ ]+)(?= |$)/g;
  const likeMatch = curQuery.match(likeRegex);
  if (likeMatch) {
    selector.like = [];
    selector['!like'] = [];
    selector.ilike = [];
    selector['!ilike'] = [];
    for (let match of likeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '~', 2);
        if (name.endsWith('!')) {
          if (value.endsWith('"i')) {
            selector['!ilike'].push([
              name.slice(0, -1),
              unQuoteString(value.slice(0, -1)),
            ]);
          } else {
            selector['!like'].push([name.slice(0, -1), unQuoteString(value)]);
          }
        } else {
          if (value.endsWith('"i')) {
            selector.ilike.push([name, unQuoteString(value.slice(0, -1))]);
          } else {
            selector.like.push([name, unQuoteString(value)]);
          }
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.like.length) {
      delete selector.like;
    }
    if (!selector['!like'].length) {
      delete selector['!like'];
    }
    if (!selector.ilike.length) {
      delete selector.ilike;
    }
    if (!selector['!ilike'].length) {
      delete selector['!ilike'];
    }
  }
  curQuery = curQuery.replace(likeRegex, '');

  // eg. {790274347f9b3a018c2cedee} or {!790274347f9b3a018c2cedee}
  const guidRegex = /(?: |^)\{!?([0-9a-f]{24})\}(?= |$)/g;
  const guidMatch = curQuery.match(guidRegex);
  if (guidMatch) {
    selector.guid = [];
    selector['!guid'] = [];
    for (let match of guidMatch) {
      try {
        let guid = match.trim().replace(/^\{|\}$/g, '');
        if (guid.startsWith('!')) {
          selector['!guid'].push(guid.slice(1));
        } else {
          selector.guid.push(guid);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.guid.length) {
      delete selector.guid;
    }
    if (!selector['!guid'].length) {
      delete selector['!guid'];
    }
  }
  curQuery = curQuery.replace(guidRegex, '');

  // eg. [enabled] or [!defaultPrimaryGroup]
  const truthyRegex = /(?: |^)\[(!?\w+)\](?= |$)/g;
  const truthyMatch = curQuery.match(truthyRegex);
  if (truthyMatch) {
    selector.truthy = [];
    selector['!truthy'] = [];
    for (let match of truthyMatch) {
      try {
        let name = match.trim().replace(/^\[|\]$/g, '');
        if (name.startsWith('!')) {
          selector['!truthy'].push(name.slice(1));
        } else {
          selector.truthy.push(name);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.truthy.length) {
      delete selector.truthy;
    }
    if (!selector['!truthy'].length) {
      delete selector['!truthy'];
    }
  }
  curQuery = curQuery.replace(truthyRegex, '');

  // eg. <archived> or <!archived>
  const tagRegex = /(?: |^)<(!?\w+)>(?= |$)/g;
  const tagMatch = curQuery.match(tagRegex);
  if (tagMatch) {
    selector.tag = [];
    selector['!tag'] = [];
    for (let match of tagMatch) {
      try {
        let name = match.trim().replace(/^<|>$/g, '');
        if (name.startsWith('!')) {
          selector['!tag'].push(name.slice(1));
        } else {
          selector.tag.push(name);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.tag.length) {
      delete selector.tag;
    }
    if (!selector['!tag'].length) {
      delete selector['!tag'];
    }
  }
  curQuery = curQuery.replace(tagRegex, '');

  // eg. cdate>15
  const gtRegex = /(?: |^)(\w+)>(-?\d+(?:\.\d+)?)(?= |$)/g;
  const gtMatch = curQuery.match(gtRegex);
  if (gtMatch) {
    selector.gt = [];
    for (let match of gtMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>', 2);
        selector.gt.push([name, Number(value)]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gt.length) {
      delete selector.gt;
    }
  }
  curQuery = curQuery.replace(gtRegex, '');

  // eg. cdate>yesterday or cdate>"2 days ago"
  const gtRelativeRegex = /(?: |^)(\w+)>(\w+|"[^"]+")(?= |$)/g;
  const gtRelativeMatch = curQuery.match(gtRelativeRegex);
  if (gtRelativeMatch) {
    if (selector.gt == null) {
      selector.gt = [];
    }
    for (let match of gtRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>', 2);
        (selector.gt as [string, null, string][]).push([
          name,
          null,
          value.replace(/"/g, ''),
        ]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gt.length) {
      delete selector.gt;
    }
  }
  curQuery = curQuery.replace(gtRelativeRegex, '');

  // eg. cdate>=15
  const gteRegex = /(?: |^)(\w+)>=(-?\d+(?:\.\d+)?)(?= |$)/g;
  const gteMatch = curQuery.match(gteRegex);
  if (gteMatch) {
    selector.gte = [];
    for (let match of gteMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>=', 2);
        selector.gte.push([name, Number(value)]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gte.length) {
      delete selector.gte;
    }
  }
  curQuery = curQuery.replace(gteRegex, '');

  // eg. cdate>=yesterday or cdate>="2 days ago"
  const gteRelativeRegex = /(?: |^)(\w+)>=(\w+|"[^"]+")(?= |$)/g;
  const gteRelativeMatch = curQuery.match(gteRelativeRegex);
  if (gteRelativeMatch) {
    if (selector.gte == null) {
      selector.gte = [];
    }
    for (let match of gteRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>=', 2);
        (selector.gte as [string, null, string][]).push([
          name,
          null,
          value.replace(/"/g, ''),
        ]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gte.length) {
      delete selector.gte;
    }
  }
  curQuery = curQuery.replace(gteRelativeRegex, '');

  // eg. cdate<15
  const ltRegex = /(?: |^)(\w+)<(-?\d+(?:\.\d+)?)(?= |$)/g;
  const ltMatch = curQuery.match(ltRegex);
  if (ltMatch) {
    selector.lt = [];
    for (let match of ltMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<', 2);
        selector.lt.push([name, Number(value)]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lt.length) {
      delete selector.lt;
    }
  }
  curQuery = curQuery.replace(ltRegex, '');

  // eg. cdate<yesterday or cdate<"2 days ago"
  const ltRelativeRegex = /(?: |^)(\w+)<(\w+|"[^"]+")(?= |$)/g;
  const ltRelativeMatch = curQuery.match(ltRelativeRegex);
  if (ltRelativeMatch) {
    if (selector.lt == null) {
      selector.lt = [];
    }
    for (let match of ltRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<', 2);
        (selector.lt as [string, null, string][]).push([
          name,
          null,
          value.replace(/"/g, ''),
        ]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lt.length) {
      delete selector.lt;
    }
  }
  curQuery = curQuery.replace(ltRelativeRegex, '');

  // eg. cdate<=15
  const lteRegex = /(?: |^)(\w+)<=(-?\d+(?:\.\d+)?)(?= |$)/g;
  const lteMatch = curQuery.match(lteRegex);
  if (lteMatch) {
    selector.lte = [];
    for (let match of lteMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<=', 2);
        selector.lte.push([name, Number(value)]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lte.length) {
      delete selector.lte;
    }
  }
  curQuery = curQuery.replace(lteRegex, '');

  // eg. cdate<=yesterday or cdate<="2 days ago"
  const lteRelativeRegex = /(?: |^)(\w+)<=(\w+|"[^"]+")(?= |$)/g;
  const lteRelativeMatch = curQuery.match(lteRelativeRegex);
  if (lteRelativeMatch) {
    if (selector.lte == null) {
      selector.lte = [];
    }
    for (let match of lteRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<=', 2);
        (selector.lte as [string, null, string][]).push([
          name,
          null,
          value.replace(/"/g, ''),
        ]);
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lte.length) {
      delete selector.lte;
    }
  }
  curQuery = curQuery.replace(lteRelativeRegex, '');

  return curQuery.trim();
}

function unQuoteString(input: string): string {
  if (input.match(/^".*?[^\\]"$/)) {
    return input.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return input;
}

function unQuoteAngles(input: string): string {
  return input.replace(/\\</g, '<').replace(/\\>/g, '>').replace(/\\\\/g, '\\');
}

function unQuoteCurlies(input: string): string {
  return input
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\\\/g, '\\');
}
