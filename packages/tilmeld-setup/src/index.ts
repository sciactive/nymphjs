import express, { Request } from 'express';
import { NymphOptions } from '@nymphjs/client';

export default function setup(options: NymphOptions) {
  const app = express();

  // TODO: Email verification endpoint.

  app.get('/options.js', async (request, response) => {
    response.type('text/javascript');
    response.send(`window.NymphOptions = ${JSON.stringify(options)};`);
  });

  app.use(
    '/app',
    express.static(__dirname + '/app', {
      fallthrough: true,
    })
  );
  app.use(express.static(__dirname + '/../static', { fallthrough: false }));

  return app;
}
