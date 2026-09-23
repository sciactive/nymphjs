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
      const searchClause = i !== 0 && !curQuery[i - 1].match(/\s/);
      if (currentStart == null && !searchClause) {
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
    const limitRegex = /(?:\s|^)limit:(\d+)(?=\s|$)/;
    const limitMatch = curQuery.match(limitRegex);
    if (limitMatch) {
      options.limit = Number(limitMatch[1]);
    }
    curQuery = curQuery.replace(limitRegex, '');

    const offsetRegex = /(?:\s|^)offset:(\d+)(?=\s|$)/;
    const offsetMatch = curQuery.match(offsetRegex);
    if (offsetMatch) {
      options.offset = Number(offsetMatch[1]);
    }
    curQuery = curQuery.replace(offsetRegex, '');

    // JavaScript variable names are ridiculously infeasable to check
    // thoroughly, so this is a "best attempt".
    const sortRegex =
      /(?:\s|^)sort:(-|[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)(?=\s|$)/;
    const sortMatch = curQuery.match(sortRegex);
    if (sortMatch) {
      options.sort = sortMatch[1] === '-' ? null : sortMatch[1];
    }
    curQuery = curQuery.replace(sortRegex, '');

    const reverseRegex = /(?:\s|^)reverse:(true|false|1|0)(?=\s|$)/;
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

  // This one needs to happen first, because it has entire queries in it.
  // eg. user<{User name="Hunter"}> or -user<{User name="Hunter"}>
  const qrefRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)<\{(\w+)(?=\s)/;
  // This is used to bypass badly formatted things that match the above regex.
  let offsetIndex = 0;
  let qrefMatch = curQuery.match(qrefRegex);
  while (qrefMatch) {
    let endIndex = (qrefMatch.index ?? 0) + offsetIndex + qrefMatch[0].length;
    let curOpen = 1;
    while (curOpen) {
      const indexOfNextOpen = curQuery.indexOf('<{', endIndex);
      const indexOfNextClose = curQuery.slice(endIndex).search(/(?<!\\)\}>/);

      if (indexOfNextClose < 0) {
        endIndex = curQuery.length;
        break;
      }

      if (
        indexOfNextOpen > -1 &&
        indexOfNextOpen < endIndex + indexOfNextClose
      ) {
        endIndex = indexOfNextOpen + 2;
        curOpen++;
      } else {
        endIndex += indexOfNextClose + 2;
        curOpen--;
      }
    }

    if (!('qref' in selector)) {
      selector.qref = [];
    }
    if (!('!qref' in selector)) {
      selector['!qref'] = [];
    }

    const match = curQuery.slice(
      (qrefMatch.index ?? 0) + offsetIndex,
      endIndex,
    );
    try {
      let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
      value = unQuoteCurlies(value.slice(1, -1));
      let [className, qrefQuery] = splitn(value, ' ', 2);
      const EntityClass = qrefMap[className].class;
      if (EntityClass == null) {
        throw new Error();
      }
      const qref = queryParser({
        query: qrefQuery,
        entityClass: EntityClass,
        defaultFields: qrefMap[className].defaultFields,
        qrefMap,
        bareHandler,
      });
      if (name.startsWith('-')) {
        (selector['!qref'] as [string, any][]).push([name.slice(1), qref]);
      } else {
        (selector.qref as [string, any][]).push([name, qref]);
      }
    } catch (e: any) {
      offsetIndex = endIndex;
      qrefMatch = curQuery.slice(offsetIndex).match(qrefRegex);

      if (!selector.qref?.length) {
        delete selector.qref;
      }
      if (!selector['!qref']?.length) {
        delete selector['!qref'];
      }

      continue;
    }
    if (!selector.qref?.length) {
      delete selector.qref;
    }
    if (!selector['!qref']?.length) {
      delete selector['!qref'];
    }

    curQuery =
      curQuery.slice(0, (qrefMatch.index ?? 0) + offsetIndex) +
      ' ' +
      curQuery.slice(endIndex);
    qrefMatch = curQuery.slice(offsetIndex).match(qrefRegex);
  }

  // eg. prop(some search string) or -prop(some search string)
  const searchRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)\([^\)]+\)(?=\s|\)|\}>|$)/g;
  const searchMatch = curQuery.match(searchRegex);
  if (searchMatch) {
    selector.search = [];
    selector['!search'] = [];
    for (let match of searchMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '(', 2);
        if (name.startsWith('-')) {
          selector['!search'].push([name.slice(1), value]);
        } else {
          selector.search.push([name, value]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.search.length) {
      delete selector.search;
    }
    if (!selector['!search'].length) {
      delete selector['!search'];
    }
  }
  curQuery = curQuery.replace(searchRegex, '');

  // eg. name:Marty or name:"Marty McFly" or -name:'Marty McFly'
  const searchColonRegex =
    /(?:\s|^)(?!(limit|offset|sort|reverse):)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?):("[^"]*?"|'[^']*?'|[^\s]+)(?=\s|\)|\}>|$)/g;
  const searchColonMatch = curQuery.match(searchColonRegex);
  if (searchColonMatch) {
    if (!('search' in selector)) {
      selector.search = [];
    }
    if (!('!search' in selector)) {
      selector['!search'] = [];
    }
    for (let match of searchColonMatch) {
      try {
        let [name, value] = splitn(match.trim(), ':', 2);
        if (name.startsWith('-')) {
          (selector['!search'] as [string, string][]).push([
            name.slice(1),
            value,
          ]);
        } else {
          (selector.search as [string, string][]).push([name, value]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (selector.search == null || !selector.search.length) {
      delete selector.search;
    }
    if (selector['!search'] == null || !selector['!search'].length) {
      delete selector['!search'];
    }
  }
  curQuery = curQuery.replace(searchColonRegex, '');

  // eg. someArray=[1,2] or someObject={"prop":"some value"}
  const equalJsonRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)=(\{|\[)/g;
  const equalJsonMatch = [...curQuery.matchAll(equalJsonRegex)];
  if (equalJsonMatch) {
    if (!('equal' in selector)) {
      selector.equal = [];
    }
    if (!('!equal' in selector)) {
      selector['!equal'] = [];
    }
    // Work backward to find all long JSON values.
    for (let i = equalJsonMatch.length - 1; i >= 0; i--) {
      const match = equalJsonMatch[i];
      let [name, opener] = splitn(match[0].trim(), '=', 2);
      let start = match.index + match[0].length - 1;
      let nextEndToken = curQuery.indexOf(opener === '{' ? '}' : ']', start);
      while (nextEndToken !== -1) {
        try {
          if (name.startsWith('-')) {
            (selector['!equal'] as [string, any][]).unshift([
              name.slice(1),
              JSON.parse(curQuery.substring(start, nextEndToken + 1)),
            ]);
          } else {
            (selector.equal as [string, any][]).unshift([
              name,
              JSON.parse(curQuery.substring(start, nextEndToken + 1)),
            ]);
          }

          curQuery =
            curQuery.substring(0, match.index) +
            curQuery.substring(nextEndToken + 1);
          break;
        } catch (e: any) {
          nextEndToken = curQuery.indexOf(
            opener === '{' ? '}' : ']',
            nextEndToken + 1,
          );
        }
      }
    }
    if (selector.equal == null || !selector.equal.length) {
      delete selector.equal;
    }
    if (selector['!equal'] == null || !selector['!equal'].length) {
      delete selector['!equal'];
    }
  }

  // eg. name=Marty or name="Marty McFly" or enabled=true
  const equalRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)=(""|".*?[^\\]"|[^\s]+)(?=\s|\)|\}>|$)/g;
  const equalMatch = curQuery.match(equalRegex);
  if (equalMatch) {
    if (!('equal' in selector)) {
      selector.equal = [];
    }
    if (!('!equal' in selector)) {
      selector['!equal'] = [];
    }
    for (let match of equalMatch) {
      try {
        let [name, value] = splitn(match.trim(), '=', 2);
        try {
          if (name.startsWith('-')) {
            (selector['!equal'] as [string, any][]).push([
              name.slice(1),
              JSON.parse(value),
            ]);
          } else {
            (selector.equal as [string, any][]).push([name, JSON.parse(value)]);
          }
        } catch (e: any) {
          if (name.startsWith('-')) {
            (selector['!equal'] as [string, any][]).push([
              name.slice(1),
              unQuoteString(value),
            ]);
          } else {
            (selector.equal as [string, any][]).push([
              name,
              unQuoteString(value),
            ]);
          }
        }
      } catch (e: any) {
        continue;
      }
    }
    if (selector.equal == null || !selector.equal.length) {
      delete selector.equal;
    }
    if (selector['!equal'] == null || !selector['!equal'].length) {
      delete selector['!equal'];
    }
  }
  curQuery = curQuery.replace(equalRegex, '');

  // eg. user<{790274347f9b3a018c2cedee}> or -user<{790274347f9b3a018c2cedee}>
  const refRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)<\{([0-9a-f]{24})\}>(?=\s|\)|\}>|$)/g;
  const refMatch = curQuery.match(refRegex);
  if (refMatch) {
    selector.ref = [];
    selector['!ref'] = [];
    for (let match of refMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
        if (name.startsWith('-')) {
          selector['!ref'].push([name.slice(1), value.slice(1, -1)]);
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

  // eg. someArrayOfNumbers<10> or -someObject<"some string">
  const containRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)(<(?:[^"][^>]*?|".*?[^\\]"))>(?=\s|\)|\}>|$)/g;
  const containMatch = curQuery.match(containRegex);
  if (containMatch) {
    selector.contain = [];
    selector['!contain'] = [];
    for (let match of containMatch) {
      try {
        let [name, value] = splitn(match.trim().slice(0, -1), '<', 2);
        try {
          if (name.startsWith('-')) {
            selector['!contain'].push([
              name.slice(1),
              JSON.parse(unQuoteString(value)),
            ]);
          } else {
            selector.contain.push([name, JSON.parse(unQuoteString(value))]);
          }
        } catch (e: any) {
          if (name.startsWith('-')) {
            selector['!contain'].push([name.slice(1), unQuoteString(value)]);
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

  // eg. name~/Hunter/ or -name~/hunter/i
  const posixRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)~(\/\/|\/.*?[^\\]\/)i?(?=\s|\)|\}>|$)/g;
  const posixMatch = curQuery.match(posixRegex);
  if (posixMatch) {
    selector.match = [];
    selector['!match'] = [];
    selector.imatch = [];
    selector['!imatch'] = [];
    for (let match of posixMatch) {
      try {
        let [name, value] = splitn(match.trim(), '~', 2);
        if (name.startsWith('-')) {
          if (value.endsWith('i')) {
            selector['!imatch'].push([
              name.slice(1),
              value.replace(/^\/|\/i$/g, ''),
            ]);
          } else {
            selector['!match'].push([
              name.slice(1),
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

  // eg. name~Hunter or -name~"hunter"i
  const likeRegex =
    /(?:\s|^)-?([^-\s=\[\]<>{}()][^\s=\[\]<>{}()]*?)~(""i?|".*?[^\\]"i?|[^\s]+)(?=\s|\)|\}>|$)/g;
  const likeMatch = curQuery.match(likeRegex);
  if (likeMatch) {
    selector.like = [];
    selector['!like'] = [];
    selector.ilike = [];
    selector['!ilike'] = [];
    for (let match of likeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '~', 2);
        if (name.startsWith('-')) {
          if (value.endsWith('"i')) {
            selector['!ilike'].push([
              name.slice(1),
              unQuoteString(value.slice(0, -1)),
            ]);
          } else {
            selector['!like'].push([name.slice(1), unQuoteString(value)]);
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

  // eg. {790274347f9b3a018c2cedee} or -{790274347f9b3a018c2cedee}
  const guidRegex = /(?:\s|^)-?\{([0-9a-f]{24})\}(?=\s|\)|\}>|$)/g;
  const guidMatch = curQuery.match(guidRegex);
  if (guidMatch) {
    selector.guid = [];
    selector['!guid'] = [];
    for (let match of guidMatch) {
      try {
        let guid = match.trim().replace(/^(-?)\{|\}$/g, '$1');
        if (guid.startsWith('-')) {
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

  // eg. [enabled] or -[defaultPrimaryGroup]
  const truthyRegex = /(?:\s|^)-?\[([^\s=\[\]<>{}]+?)\](?=\s|\)|\}>|$)/g;
  const truthyMatch = curQuery.match(truthyRegex);
  if (truthyMatch) {
    selector.truthy = [];
    selector['!truthy'] = [];
    for (let match of truthyMatch) {
      try {
        let name = match.trim().replace(/^(-?)\[|\]$/g, '$1');
        if (name.startsWith('-')) {
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

  // eg. <archived> or -<archived>
  const tagRegex = /(?:\s|^)-?<(\w+)>(?=\s|\)|\}>|$)/g;
  const tagMatch = curQuery.match(tagRegex);
  if (tagMatch) {
    selector.tag = [];
    selector['!tag'] = [];
    for (let match of tagMatch) {
      try {
        let name = match.trim().replace(/^(-?)<|>$/g, '$1');
        if (name.startsWith('-')) {
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

  // eg. cdate>15 or -cdate>15
  const gtRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)>(-?\d+(?:\.\d+)?)(?=\s|\)|\}>|$)/g;
  const gtMatch = curQuery.match(gtRegex);
  if (gtMatch) {
    selector.gt = [];
    selector['!gt'] = [];
    for (let match of gtMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>', 2);
        if (name.startsWith('-')) {
          selector['!gt'].push([name.slice(1), Number(value)]);
        } else {
          selector.gt.push([name, Number(value)]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gt.length) {
      delete selector.gt;
    }
    if (!selector['!gt'].length) {
      delete selector['!gt'];
    }
  }
  curQuery = curQuery.replace(gtRegex, '');

  // eg. cdate>yesterday or -cdate>"2 days ago"
  const gtRelativeRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)>(\w+|"[^"]+")(?=\s|\)|\}>|$)/g;
  const gtRelativeMatch = curQuery.match(gtRelativeRegex);
  if (gtRelativeMatch) {
    if (selector.gt == null) {
      selector.gt = [];
    }
    if (selector['!gt'] == null) {
      selector['!gt'] = [];
    }
    for (let match of gtRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>', 2);
        if (name.startsWith('-')) {
          (selector['!gt'] as [string, null, string][]).push([
            name.slice(1),
            null,
            value.replace(/"/g, ''),
          ]);
        } else {
          (selector.gt as [string, null, string][]).push([
            name,
            null,
            value.replace(/"/g, ''),
          ]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gt.length) {
      delete selector.gt;
    }
    if (!selector['!gt'].length) {
      delete selector['!gt'];
    }
  }
  curQuery = curQuery.replace(gtRelativeRegex, '');

  // eg. cdate>=15 or -cdate>=15
  const gteRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)>=(-?\d+(?:\.\d+)?)(?=\s|\)|\}>|$)/g;
  const gteMatch = curQuery.match(gteRegex);
  if (gteMatch) {
    selector.gte = [];
    selector['!gte'] = [];
    for (let match of gteMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>=', 2);
        if (name.startsWith('-')) {
          selector['!gte'].push([name.slice(1), Number(value)]);
        } else {
          selector.gte.push([name, Number(value)]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gte.length) {
      delete selector.gte;
    }
    if (!selector['!gte'].length) {
      delete selector['!gte'];
    }
  }
  curQuery = curQuery.replace(gteRegex, '');

  // eg. cdate>=yesterday or -cdate>="2 days ago"
  const gteRelativeRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)>=(\w+|"[^"]+")(?=\s|\)|\}>|$)/g;
  const gteRelativeMatch = curQuery.match(gteRelativeRegex);
  if (gteRelativeMatch) {
    if (selector.gte == null) {
      selector.gte = [];
    }
    if (selector['!gte'] == null) {
      selector['!gte'] = [];
    }
    for (let match of gteRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '>=', 2);
        if (name.startsWith('-')) {
          (selector['!gte'] as [string, null, string][]).push([
            name.slice(1),
            null,
            value.replace(/"/g, ''),
          ]);
        } else {
          (selector.gte as [string, null, string][]).push([
            name,
            null,
            value.replace(/"/g, ''),
          ]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.gte.length) {
      delete selector.gte;
    }
    if (!selector['!gte'].length) {
      delete selector['!gte'];
    }
  }
  curQuery = curQuery.replace(gteRelativeRegex, '');

  // eg. cdate<15 or -cdate<15
  const ltRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)<(-?\d+(?:\.\d+)?)(?=\s|\)|\}>|$)/g;
  const ltMatch = curQuery.match(ltRegex);
  if (ltMatch) {
    selector.lt = [];
    selector['!lt'] = [];
    for (let match of ltMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<', 2);
        if (name.startsWith('-')) {
          selector['!lt'].push([name.slice(1), Number(value)]);
        } else {
          selector.lt.push([name, Number(value)]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lt.length) {
      delete selector.lt;
    }
    if (!selector['!lt'].length) {
      delete selector['!lt'];
    }
  }
  curQuery = curQuery.replace(ltRegex, '');

  // eg. cdate<yesterday or -cdate<"2 days ago"
  const ltRelativeRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)<(\w+|"[^"]+")(?=\s|\)|\}>|$)/g;
  const ltRelativeMatch = curQuery.match(ltRelativeRegex);
  if (ltRelativeMatch) {
    if (selector.lt == null) {
      selector.lt = [];
    }
    if (selector['!lt'] == null) {
      selector['!lt'] = [];
    }
    for (let match of ltRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<', 2);
        if (name.startsWith('-')) {
          (selector['!lt'] as [string, null, string][]).push([
            name.slice(1),
            null,
            value.replace(/"/g, ''),
          ]);
        } else {
          (selector.lt as [string, null, string][]).push([
            name,
            null,
            value.replace(/"/g, ''),
          ]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lt.length) {
      delete selector.lt;
    }
    if (!selector['!lt'].length) {
      delete selector['!lt'];
    }
  }
  curQuery = curQuery.replace(ltRelativeRegex, '');

  // eg. cdate<=15 or -cdate<=15
  const lteRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)<=(-?\d+(?:\.\d+)?)(?=\s|\)|\}>|$)/g;
  const lteMatch = curQuery.match(lteRegex);
  if (lteMatch) {
    selector.lte = [];
    selector['!lte'] = [];
    for (let match of lteMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<=', 2);
        if (name.startsWith('-')) {
          selector['!lte'].push([name.slice(1), Number(value)]);
        } else {
          selector.lte.push([name, Number(value)]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lte.length) {
      delete selector.lte;
    }
    if (!selector['!lte'].length) {
      delete selector['!lte'];
    }
  }
  curQuery = curQuery.replace(lteRegex, '');

  // eg. cdate<=yesterday or -cdate<="2 days ago"
  const lteRelativeRegex =
    /(?:\s|^)-?([^\s=\[\]<>{}]+?)<=(\w+|"[^"]+")(?=\s|\)|\}>|$)/g;
  const lteRelativeMatch = curQuery.match(lteRelativeRegex);
  if (lteRelativeMatch) {
    if (selector.lte == null) {
      selector.lte = [];
    }
    if (selector['!lte'] == null) {
      selector['!lte'] = [];
    }
    for (let match of lteRelativeMatch) {
      try {
        let [name, value] = splitn(match.trim(), '<=', 2);
        if (name.startsWith('-')) {
          (selector['!lte'] as [string, null, string][]).push([
            name.slice(1),
            null,
            value.replace(/"/g, ''),
          ]);
        } else {
          (selector.lte as [string, null, string][]).push([
            name,
            null,
            value.replace(/"/g, ''),
          ]);
        }
      } catch (e: any) {
        continue;
      }
    }
    if (!selector.lte.length) {
      delete selector.lte;
    }
    if (!selector['!lte'].length) {
      delete selector['!lte'];
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
