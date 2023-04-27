import express from 'express';
import strtotime from 'locutus/php/datetime/strtotime';
import type { NymphOptions } from '@nymphjs/client';
import type { Nymph } from '@nymphjs/nymph';
import { enforceTilmeld } from '@nymphjs/tilmeld';

export function setup(
  options: NymphOptions,
  nymph: Nymph,
  { allowRegistration = false }: { allowRegistration?: boolean } = {}
) {
  const app = express();
  const tilmeld = enforceTilmeld(nymph);

  app.use('/verify', async (request, response, next) => {
    if (!tilmeld.config.verifyEmail || request.query.action == null) {
      next();
    }

    function escapeHtml(text: string) {
      var map: { [k: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };

      return text.replace(/[&<>"']/g, function (m) {
        return map[m];
      });
    }

    function printSuccess(notice: string, redirect: string) {
      response.status(303);
      response.setHeader('Location', redirect);

      response.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Email Verification</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="4; url="${escapeHtml(redirect)}">
  </head>
  <body>
    <p>
      ${escapeHtml(notice)}
      <br />
      You will now be redirected.
    </p>
  </body>
</html>`);
    }

    function printError(code: number, notice: string) {
      response.status(code);

      response.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Email Verification</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <p>
      ${escapeHtml(notice)}
    </p>
  </body>
</html>`);
    }

    const user = await tilmeld.User.factory(`${request.query.id}`);

    if (user.guid == null) {
      printError(500, 'An error occurred.');
      return;
    }

    switch (request.query.action) {
      default:
        printError(500, 'An error occurred.');
        return;
      case 'verify':
        // Verify new user's email address.
        if (user.secret == null || request.query.secret !== user.secret) {
          printError(500, 'An error occurred.');
          return;
        }

        if (tilmeld.config.unverifiedAccess) {
          user.groups = await nymph.getEntities(
            { class: tilmeld.Group, skipAc: true },
            { type: '&', equal: ['defaultSecondary', true] }
          );
        }
        user.enabled = true;
        delete user.secret;
        break;
      case 'verifychange':
        // Email address change.
        if (
          user.newEmailSecret == null ||
          user.newEmailAddress == null ||
          request.query.secret !== user.newEmailSecret
        ) {
          printError(500, 'An error occurred.');
          return;
        }

        user.email = user.newEmailAddress;
        user.$originalEmail = user.newEmailAddress;
        if (tilmeld.config.emailUsernames) {
          user.username = user.email;
          const unCheck = await user.$checkUsername();
          if (!unCheck.result) {
            printError(400, unCheck.message);
            return;
          }
        }

        const unCheck = await user.$checkEmail();
        if (!unCheck.result) {
          printError(400, unCheck.message);
          return;
        }

        delete user.newEmailAddress;
        delete user.newEmailSecret;
        break;
      case 'cancelchange':
        // Cancel an email address change.
        if (
          user.cancelEmailSecret == null ||
          user.cancelEmailAddress == null ||
          request.query.secret !== user.cancelEmailSecret
        ) {
          printError(500, 'An error occurred.');
          return;
        }

        if (
          tilmeld.config.emailRateLimit !== '' &&
          user.emailChangeDate != null &&
          user.emailChangeDate <
            (strtotime('-' + tilmeld.config.emailRateLimit) || 0) * 1000
        ) {
          printError(
            400,
            "That email change cancellation link has expired. Please contact an administrator if you can't access your account."
          );
          return;
        }

        user.email = user.cancelEmailAddress;
        user.$originalEmail = user.cancelEmailAddress;
        if (tilmeld.config.emailUsernames) {
          user.username = user.email;
        }

        delete user.newEmailAddress;
        delete user.newEmailSecret;
        delete user.cancelEmailAddress;
        delete user.cancelEmailSecret;
        break;
    }

    if (await user.$saveSkipAC()) {
      switch (request.query.action) {
        case 'verify':
        default:
          printSuccess(
            'Your account has been verified.',
            tilmeld.config.verifyRedirect
          );
          break;
        case 'verifychange':
          printSuccess(
            'Your new email address has been verified.',
            tilmeld.config.verifyChangeRedirect
          );
          break;
        case 'cancelchange':
          printSuccess(
            'The email address change has been canceled.',
            tilmeld.config.cancelChangeRedirect
          );
          break;
      }
    } else {
      printError(500, 'An error occurred.');
    }
  });

  app.get('/options.js', async (_request, response) => {
    response.type('text/javascript');
    response.send(
      `window.nymphOptions = ${JSON.stringify(options)};\n` +
        `window.allowRegistration = ${JSON.stringify(allowRegistration)};\n` +
        `window.appUrl = ${JSON.stringify(tilmeld.config.appUrl)};`
    );
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

export default setup;
