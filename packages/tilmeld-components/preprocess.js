import fs from 'fs';
import { preprocess } from 'svelte/compiler';
import sveltePreprocess from 'svelte-preprocess';

const { typescript } = sveltePreprocess;

async function process(filename, target) {
  const { code, map } = await preprocess(
    fs.readFileSync(filename).toString(),
    [typescript()],
    {
      filename,
    }
  );

  fs.writeFileSync(
    target,
    code.replace(/<script lang="ts">/g, () => '<script>')
  );
  fs.writeFileSync(`${target}.map`, JSON.stringify(map));
}

process('src/Account.svelte', 'lib/Account.svelte');
process('src/ChangePassword.svelte', 'lib/ChangePassword.svelte');
process('src/Login.svelte', 'lib/Login.svelte');
process('src/Recover.svelte', 'lib/Recover.svelte');
