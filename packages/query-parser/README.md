# Nymph Query Parser

Powerful object data storage and querying.

The Query Parser is a utility for creating complex Nymph entity queries from a simple text input. Essentially, it turns a string into a Nymph query.

## Installation

```sh
npm install --save @nymphjs/query-parser
```

## Usage

The query parser will turn a string into an Options and Selectors array for the Nymph Client. It has a syntax that allows for _most_ features of a Nymph query to be expressed in a text input.

```ts
import queryParser from '@nymphjs/query-parser';

import BlogPost from './BlogPost';
import Category from './Category';

async function doQuery() {
  const [options, ...selectors] = queryParser({
    query:
      'limit:4 sort:mdate foobar (| [archived] mdate<"2 weeks ago") category<{cat Tech}>',
    entityClass: BlogPost,
    defaultFields: ['title', 'body'],
    qrefMap: {
      cat: {
        class: Category,
        defaultFields: ['name'],
      },
    },
  });
  /*
  Options will be
    {
      class: BlogPost,
      limit: 4,
      sort: 'mdate'
    }

  And selectors will be (equivalent to)
    [
      {
        type: "|",
        truthy: [
          "archived"
        ],
        lt: [
          ["mdate", null, "2 weeks ago"]
        ]
      },
      {
        type: "&",
        qref: [
          "category",
          [
            {
              class: Category
            },
            {
              type: "|",
              ilike: ["name", "%Tech%"]
            }
          ]
        ]
      },
      {
        type: "|",
        ilike: [
          ["title", "%foobar%"],
          ["body", "%foobar%"]
        ]
      }
    ]
  */
  const entities = await nymph.getEntities(options, ...selectors);
}
```

## Options

You can set limit, offset, sort, and reverse like this.

- `limit:number`
- `offset:number`
- `sort:string`
- `reverse:true`, `reverse:false`, `reverse:1`, or `reverse:0`

These must appear in the top level of the query (outside of any parentheses).

## Clauses

These are the available clauses, and their syntax.

### equal and !equal

Check for string or JSON representation equality.

- `name=string` or `name!=string`
- `name="string value"` or `name!="string value"`
  - (Use this if you have a space in your string, or if your string could be interpreted as valid JSON. Escape double quotes with a leading backslash.)
- `name=JSON` or `name!=JSON`
  - (Match a JSON encoded value (like `true`, `1`, `[1,2,3]`, or `{"prop":"val"}`).)

### guid and !guid

Check for entity GUID.

- `{guid}` or `{!guid}`

### tag and !tag

Check for a tag.

- `<name>` or `<!name>`

### truthy and !truthy

Check for truthiness.

- `[name]` or `[!name]`

### ref and !ref

Check for a reference to another entity.

- `name<{guid}>` or `name!<{guid}>`

### qref and !qref

Check for a reference to another entity using a query.

- `name<{refclassname inner query}>` or `name!<{refclassname inner query}>`
  - (Escape curly brackets with a leading backslash.)
  - (Requires a map of refclassname to their actual class and default fields.)

### contain and !contain

Check if the array at the named property contains a value.

- `name<value>` or `name!<value>`
  - (Escape angle brackets with a leading backslash. If your value could be interpreted as valid JSON, encode it as a JSON string and use the JSON syntax instead.)
- `name<JSON>` or `name!<JSON>`
  - (Search for a JSON encoded value (like `true`, `1`, `[1,2,3]`, or `{"prop":"val"}`).)

### match and !match

Check for POSIX regex match.

- `name~/pattern/` or `name!~/pattern/`

### imatch and !imatch

Check for case insensitive POSIX regex match.

- `name~/pattern/i` or `name!~/pattern/i`

### like and !like

Check for pattern match where \_ is single char wildcard and % is any length wildcard.

- `name~pattern` or `name!~pattern`
- `name~"pattern"` or `name!~"pattern"`
  - (Use this if you have a space in your pattern.)

### ilike and !ilike

Check for case insensitive pattern match where \_ is single char wildcard and % is any length wildcard.

- `name~"pattern"i` or `name!~"pattern"i`

### gt

Check a prop's value is greater than a given value.

- `name>number`
- `name>relative`
  - (A single relative time value like `now` or `yesterday`.)
- `name>"relative time value"`
  - (Use this for a time value with a space like `"two days from now"`, `"last thursday"`, `"+4 weeks"`, or `"5 minutes ago"`.)

### gte

Check a prop's value is greater than or equal to a given value.

- `name>=number`
- `name>=relative`
  - (A single relative time value like `now` or `yesterday`.)
- `name>="relative time value"`
  - (Use this for a time value with a space like `"two days from now"`, `"last thursday"`, `"+4 weeks"`, or `"5 minutes ago"`.)

### lt

Check a prop's value is less than a given value.

- `name<number`
- `name<relative`
  - (A single relative time value like `now` or `yesterday`.)
- `name<"relative time value"`
  - (Use this for a time value with a space like `"two days from now"`, `"last thursday"`, `"+4 weeks"`, or `"5 minutes ago"`.)

### lte

Check a prop's value is less than or equal to a given value.

- `name<=number`
- `name<=relative`
  - (A single relative time value like `now` or `yesterday`.)
- `name<="relative time value"`
  - (Use this for a time value with a space like `"two days from now"`, `"last thursday"`, `"+4 weeks"`, or `"5 minutes ago"`.)

## Selectors

You can specify nested selectors with different types using pairs of parentheses. The first character (or two) inside the parentheses can be a type: "&", "!&", "|", "!|", or "!" (the same as "!&").

Here are some examples of nested selectors.

```
Either enabled is truthy and abilities contains "subscriber", or abilities contains "lifelong-subscriber".

(| ([enabled] abilities<"subscriber">) abilities<"lifeline-subscriber">)


Published is not truthy and cdate is not greater than 6 months ago.

(! [published] cdate>"6 months ago")
```

## Default Fields

Anything contained in the query (including in selector parentheses) that doesn't match any of the options or clause syntaxes listed above (bare query parts) will be added (at the appropriate nesting level) to a selector with an `"|"` type in an `ilike` clause surrounded by "%" characters for each field passed in to the `defaultFields` argument.

## Bare Query Handler

You can also supply a function in the option `bareHandler` that will handle bare query parts instead of the "Default Fields" behavior described above. It will receive three arguments, the query parts, the entity class, and the default fields entry for that class. It should return a partial selector that will replace or extend the `"|"` selector.

# License

Copyright 2021-2024 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
