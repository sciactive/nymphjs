import * as v from 'valibot';

export const nymphValibotProps = {
  guid: v.nullable(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  cdate: v.nullable(v.number()),
  mdate: v.nullable(v.number()),
  tags: v.array(
    v.pipe(
      v.string(),
      v.regex(
        /^[^\x00-\x1F\x7F\[\],]+$/,
        'Tags must be non-empty strings without square brackets, control characters, or commas.',
      ),
    ),
  ),
};
