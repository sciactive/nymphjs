import * as v from 'valibot';
import { GUIDSchema, PropertyNameSchema, TagSchema } from '@nymphjs/nymph';

type JsonData =
  string | number | boolean | null | { [key: string]: JsonData } | JsonData[];

const JsonSchema: v.GenericSchema<JsonData> = v.lazy(() =>
  v.union([
    v.string(),
    v.number(),
    v.boolean(),
    v.null(),
    v.record(v.string(), JsonSchema),
    v.array(JsonSchema),
  ]),
);

export const EntityJsonSchema = v.strictObject({
  class: v.tuple([v.literal('nymph_class_reference'), v.string()]),
  guid: v.nullable(GUIDSchema),
  cdate: v.nullable(v.number()),
  mdate: v.nullable(v.number()),
  tags: v.array(TagSchema),
  data: v.record(PropertyNameSchema, JsonSchema),
});

export const EntityPatchSchema = v.strictObject({
  class: v.tuple([v.literal('nymph_class_reference'), v.string()]),
  guid: GUIDSchema,
  mdate: v.nullable(v.number()),
  set: v.record(PropertyNameSchema, JsonSchema),
  unset: v.array(PropertyNameSchema),
  addTags: v.array(TagSchema),
  removeTags: v.array(TagSchema),
});

export const NymphNewUidRequestSchema = v.strictObject({
  action: v.literal('uid'),
  data: v.string(),
});
export const NymphSetUidRequestSchema = v.strictObject({
  action: v.literal('uid'),
  data: v.strictObject({ name: v.string(), value: v.number() }),
});
export const NymphGetUidRequestSchema = v.strictObject({
  action: v.literal('uid'),
  data: v.string(),
});
export const NymphDeleteUidRequestSchema = v.strictObject({
  action: v.literal('uid'),
  data: v.string(),
});
export const NymphUidRequestSchema = v.union([
  NymphNewUidRequestSchema,
  NymphSetUidRequestSchema,
  NymphGetUidRequestSchema,
  NymphDeleteUidRequestSchema,
]);

export const NymphEntityMethodRequestPluralSchema = v.strictObject({
  action: v.literal('entities'),
  data: v.array(v.union([EntityJsonSchema, EntityPatchSchema])),
});
export const NymphEntityMethodRequestSingularSchema = v.strictObject({
  action: v.literal('entity'),
  data: v.union([EntityJsonSchema, EntityPatchSchema]),
});
export const NymphEntityMethodRequestSchema = v.union([
  NymphEntityMethodRequestPluralSchema,
  NymphEntityMethodRequestSingularSchema,
]);

export const NymphEntityDeleteRequestPluralSchema = v.strictObject({
  action: v.literal('entities'),
  data: v.array(v.strictObject({ guid: GUIDSchema, class: v.string() })),
});
export const NymphEntityDeleteRequestSingularSchema = v.strictObject({
  action: v.literal('entity'),
  data: v.strictObject({ guid: GUIDSchema, class: v.string() }),
});
export const NymphEntityDeleteRequestSchema = v.union([
  NymphEntityDeleteRequestPluralSchema,
  NymphEntityDeleteRequestSingularSchema,
]);

export const NymphEntityQueryRequestSchema = v.strictObject({
  action: v.picklist(['entity', 'entities']),
  data: v.array(v.any()),
});

export const NymphEntityServerCallRequestPushStateSchema = v.strictObject({
  action: v.literal('method'),
  data: v.strictObject({
    static: v.optional(v.literal(false)),
    entity: EntityJsonSchema,
    pushState: v.literal(true),
    pullState: v.boolean(),
    method: v.string(),
    params: v.array(v.any()),
  }),
});
export const NymphEntityServerCallRequestNoPushStateSchema = v.strictObject({
  action: v.literal('method'),
  data: v.strictObject({
    class: v.string(),
    static: v.optional(v.literal(false)),
    guid: v.nullable(GUIDSchema),
    pushState: v.literal(false),
    pullState: v.boolean(),
    method: v.string(),
    params: v.array(v.any()),
  }),
});
export const NymphEntityServerCallRequestStaticSchema = v.strictObject({
  action: v.literal('method'),
  data: v.strictObject({
    class: v.string(),
    static: v.literal(true),
    iterator: v.optional(v.literal(false)),
    method: v.string(),
    params: v.array(v.any()),
  }),
});
export const NymphEntityServerCallRequestStaticIteratorSchema = v.strictObject({
  action: v.literal('method'),
  data: v.strictObject({
    class: v.string(),
    static: v.literal(true),
    iterator: v.literal(true),
    method: v.string(),
    params: v.array(v.any()),
  }),
});
export const NymphEntityServerCallRequestSchema = v.union([
  NymphEntityServerCallRequestPushStateSchema,
  NymphEntityServerCallRequestNoPushStateSchema,
  NymphEntityServerCallRequestStaticSchema,
  NymphEntityServerCallRequestStaticIteratorSchema,
]);

export const NymphRequestSchema = v.union([
  NymphUidRequestSchema,
  NymphEntityMethodRequestSchema,
  NymphEntityDeleteRequestSchema,
  NymphEntityQueryRequestSchema,
  NymphEntityServerCallRequestSchema,
]);
