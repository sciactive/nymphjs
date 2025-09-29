import type { Entity } from '@nymphjs/client';
import queryParser from './queryParser.js';

const BlogPost = function () {} as unknown as typeof Entity;
const Category = function () {} as unknown as typeof Entity;

describe('queryParser', () => {
  it('parses a basic query', () => {
    const query = 'search';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['text'],
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '|',
        ilike: [['text', '%search%']],
      },
    ]);
  });

  it('allows bare queries to be customized', () => {
    const query = 'search';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['text'],
      bareHandler: (input, entityClass, defaultFields) => {
        expect(input).toEqual('search');
        expect(entityClass).toBe(BlogPost);
        expect(defaultFields).toEqual(['text']);

        return {
          equal: ['custom', input],
        };
      },
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '|',
        equal: ['custom', 'search'],
      },
    ]);
  });

  it('gives the correct entity and default fields to bare queries', () => {
    const query = 'category<{cat search}>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['text'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
      bareHandler: (input, entityClass, defaultFields) => {
        expect(input).toEqual('search');
        expect(entityClass).toBe(Category);
        expect(defaultFields).toEqual(['name']);

        return {
          type: '!&',
          equal: ['custom', input],
        };
      },
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        qref: [
          [
            'category',
            [{ class: Category }, { type: '!&', equal: ['custom', 'search'] }],
          ],
        ],
      },
    ]);
  });

  it('parses the example query from the readme', () => {
    const query =
      'limit:4 foobar (| [archived] mdate<"2 weeks ago") category<{cat Tech}>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 4,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        selector: [
          {
            type: '|',
            truthy: ['archived'],
            lt: [['mdate', null, '2 weeks ago']],
          },
        ],
        qref: [
          [
            'category',
            [
              {
                class: Category,
              },
              {
                type: '|',
                ilike: [['name', '%Tech%']],
              },
            ],
          ],
        ],
      },
      {
        type: '|',
        ilike: [
          ['title', '%foobar%'],
          ['body', '%foobar%'],
        ],
      },
    ]);
  });

  it('parses a query with lt and tag', () => {
    const query = 'limit:4 foobar mdate<"2 weeks ago" <tag>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 4,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lt: [['mdate', null, '2 weeks ago']],
        tag: ['tag'],
      },
      {
        type: '|',
        ilike: [
          ['title', '%foobar%'],
          ['body', '%foobar%'],
        ],
      },
    ]);
  });

  it('parses a query with contain that has brackets', () => {
    const query = 'limit:4 foobar string<"a string with < and > characters">';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 4,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        contain: [['string', 'a string with < and > characters']],
      },
      {
        type: '|',
        ilike: [
          ['title', '%foobar%'],
          ['body', '%foobar%'],
        ],
      },
    ]);
  });

  it('parses a query with contain that has quotes', () => {
    const query = 'limit:4 foobar string<"a string with a \\" characters">';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 4,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        contain: [['string', 'a string with a " characters']],
      },
      {
        type: '|',
        ilike: [
          ['title', '%foobar%'],
          ['body', '%foobar%'],
        ],
      },
    ]);
  });

  it('parses a query with a dash in the property name', () => {
    const query = 'limit:4 foobar Test-Prop<"a string">';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        cat: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 4,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        contain: [['Test-Prop', 'a string']],
      },
      {
        type: '|',
        ilike: [
          ['title', '%foobar%'],
          ['body', '%foobar%'],
        ],
      },
    ]);
  });

  it('parses all options', () => {
    const query = 'limit:10 offset:15 sort:someProp reverse:true search';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['text'],
    });

    expect(options).toEqual({
      class: BlogPost,
      limit: 10,
      offset: 15,
      sort: 'someProp',
      reverse: true,
    });

    expect(selectors).toEqual([
      {
        type: '|',
        ilike: [['text', '%search%']],
      },
    ]);
  });

  it('parses simple equal clauses', () => {
    const query = 'prop=string';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        equal: [['prop', 'string']],
      },
    ]);
  });

  it('parses simple not equal clauses', () => {
    const query = 'prop!=string';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!equal': [['prop', 'string']],
      },
    ]);
  });

  it('parses quoted equal clauses', () => {
    const query = 'prop="a string"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        equal: [['prop', 'a string']],
      },
    ]);
  });

  it('parses quoted not equal clauses', () => {
    const query = 'prop!="a string"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!equal': [['prop', 'a string']],
      },
    ]);
  });

  it('parses json equal clauses', () => {
    const query = 'prop=true';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        equal: [['prop', true]],
      },
    ]);
  });

  it('parses json not equal clauses', () => {
    const query = 'prop!=true';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!equal': [['prop', true]],
      },
    ]);
  });

  it('parses guid clauses', () => {
    const query = '{111111111111111111111111}';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        guid: ['111111111111111111111111'],
      },
    ]);
  });

  it('parses not guid clauses', () => {
    const query = '{!111111111111111111111111}';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!guid': ['111111111111111111111111'],
      },
    ]);
  });

  it('parses tag clauses', () => {
    const query = '<tagname>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        tag: ['tagname'],
      },
    ]);
  });

  it('parses not tag clauses', () => {
    const query = '<!tagname>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!tag': ['tagname'],
      },
    ]);
  });

  it('parses truthy clauses', () => {
    const query = '[truthyname]';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        truthy: ['truthyname'],
      },
    ]);
  });

  it('parses not truthy clauses', () => {
    const query = '[!truthyname]';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!truthy': ['truthyname'],
      },
    ]);
  });

  it('parses ref clauses', () => {
    const query = 'prop<{111111111111111111111111}>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        ref: [['prop', '111111111111111111111111']],
      },
    ]);
  });

  it('parses not ref clauses', () => {
    const query = 'prop!<{111111111111111111111111}>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!ref': [['prop', '111111111111111111111111']],
      },
    ]);
  });

  it('parses simple contain clauses', () => {
    const query = 'prop<string>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        contain: [['prop', 'string']],
      },
    ]);
  });

  it('parses simple not contain clauses', () => {
    const query = 'prop!<string>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!contain': [['prop', 'string']],
      },
    ]);
  });

  it('parses json contain clauses', () => {
    const query = 'prop<true>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        contain: [['prop', true]],
      },
    ]);
  });

  it('parses json not contain clauses', () => {
    const query = 'prop!<true>';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!contain': [['prop', true]],
      },
    ]);
  });

  it('parses match clauses', () => {
    const query = 'prop~/regex/';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        match: [['prop', 'regex']],
      },
    ]);
  });

  it('parses not match clauses', () => {
    const query = 'prop!~/regex/';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!match': [['prop', 'regex']],
      },
    ]);
  });

  it('parses imatch clauses', () => {
    const query = 'prop~/regex/i';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        imatch: [['prop', 'regex']],
      },
    ]);
  });

  it('parses not imatch clauses', () => {
    const query = 'prop!~/regex/i';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!imatch': [['prop', 'regex']],
      },
    ]);
  });

  it('parses simple like clauses', () => {
    const query = 'prop~pattern';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        like: [['prop', 'pattern']],
      },
    ]);
  });

  it('parses simple not like clauses', () => {
    const query = 'prop!~pattern';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!like': [['prop', 'pattern']],
      },
    ]);
  });

  it('parses quoted like clauses', () => {
    const query = 'prop~"a pattern"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        like: [['prop', 'a pattern']],
      },
    ]);
  });

  it('parses quoted not like clauses', () => {
    const query = 'prop!~"a pattern"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!like': [['prop', 'a pattern']],
      },
    ]);
  });

  it('parses ilike clauses', () => {
    const query = 'prop~"a pattern"i';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        ilike: [['prop', 'a pattern']],
      },
    ]);
  });

  it('parses not ilike clauses', () => {
    const query = 'prop!~"a pattern"i';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        '!ilike': [['prop', 'a pattern']],
      },
    ]);
  });

  it('parses simple gt clauses', () => {
    const query = 'prop>30.5';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gt: [['prop', 30.5]],
      },
    ]);
  });

  it('parses simple relative gt clauses', () => {
    const query = 'prop>yesterday';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gt: [['prop', null, 'yesterday']],
      },
    ]);
  });

  it('parses quote relative gt clauses', () => {
    const query = 'prop>"3 weeks ago"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gt: [['prop', null, '3 weeks ago']],
      },
    ]);
  });

  it('parses simple gte clauses', () => {
    const query = 'prop>=30.5';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gte: [['prop', 30.5]],
      },
    ]);
  });

  it('parses simple relative gte clauses', () => {
    const query = 'prop>=yesterday';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gte: [['prop', null, 'yesterday']],
      },
    ]);
  });

  it('parses quote relative gte clauses', () => {
    const query = 'prop>="3 weeks ago"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        gte: [['prop', null, '3 weeks ago']],
      },
    ]);
  });

  it('parses simple lt clauses', () => {
    const query = 'prop<30.5';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lt: [['prop', 30.5]],
      },
    ]);
  });

  it('parses simple relative lt clauses', () => {
    const query = 'prop<yesterday';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lt: [['prop', null, 'yesterday']],
      },
    ]);
  });

  it('parses quote relative lt clauses', () => {
    const query = 'prop<"3 weeks ago"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lt: [['prop', null, '3 weeks ago']],
      },
    ]);
  });

  it('parses simple lte clauses', () => {
    const query = 'prop<=30.5';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lte: [['prop', 30.5]],
      },
    ]);
  });

  it('parses simple relative lte clauses', () => {
    const query = 'prop<=yesterday';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lte: [['prop', null, 'yesterday']],
      },
    ]);
  });

  it('parses quote relative lte clauses', () => {
    const query = 'prop<="3 weeks ago"';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        lte: [['prop', null, '3 weeks ago']],
      },
    ]);
  });

  it('parses complex selectors', () => {
    const query =
      '(! [published] <draft>) (| cdate>"6 months ago" mdate>"1 month ago")';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        selector: [
          {
            type: '|',
            gt: [
              ['cdate', null, '6 months ago'],
              ['mdate', null, '1 month ago'],
            ],
          },
          {
            type: '!&',
            truthy: ['published'],
            tag: ['draft'],
          },
        ],
      },
    ]);
  });

  it('parses nested selectors', () => {
    const query =
      '(! [published] <draft> (| cdate>"6 months ago" mdate>"1 month ago"))';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '!&',
        truthy: ['published'],
        tag: ['draft'],
        selector: [
          {
            type: '|',
            gt: [
              ['cdate', null, '6 months ago'],
              ['mdate', null, '1 month ago'],
            ],
          },
        ],
      },
    ]);
  });

  it('parses nested qref clauses', () => {
    const query =
      'categories<{Category parent<{Category id="sort+newsletters"}>}> ';
    const [options, ...selectors] = queryParser({
      query,
      entityClass: BlogPost,
      defaultFields: ['title', 'body'],
      qrefMap: {
        Category: {
          class: Category,
          defaultFields: ['name'],
        },
      },
    });

    expect(options).toEqual({
      class: BlogPost,
    });

    expect(selectors).toEqual([
      {
        type: '&',
        qref: [
          [
            'categories',
            [
              { class: Category },
              {
                type: '&',
                qref: [
                  [
                    'parent',
                    [
                      { class: Category },
                      {
                        type: '&',
                        equal: [['id', 'sort+newsletters']],
                      },
                    ],
                  ],
                ],
              },
            ],
          ],
        ],
      },
    ]);
  });
});
