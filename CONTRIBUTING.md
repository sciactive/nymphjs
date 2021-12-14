# Contributing

Thank you for contributing! There are some guidelines you should know. First, let's get you started.

## Setting up Your Dev Environment

The first step is to fork the repo. Once you've got your own fork, check it out locally.

```
git clone git@github.com:yourusername/nymphjs.git nymphjs
```

Now let's get the repo set up for development.

```
cd nymphjs

# This will take a while as it runs bootstrap.
npm i
```

Now you're set up. If there are package-lock.json files updated after setting up, feel free to reset those changes.

## Testing

When you need to test something that involves one of the bigger DBs, there are DB run scripts called `test:db:run` that will set up a DB running in a docker container in the MySQL and Postgres driver directories. You can start all of them with the `test:db:run` script in the root dir.

Once the DB container is running, you can run the `test` script.

To stop the containers, don't use ctrl+C, instead run the `test:db:stop` script in another terminal window.

### Test Tilmeld Setup App

You can run `node packages/tilmeld-setup/test.mjs` to run a test Tilmeld Setup application available at [http://localhost:8080/user/](http://localhost:8080/user/).

## Commiting Changes

Nymph.js uses Prettier to format code. You should use Prettier after you've edited a file before you commit it. You can set up your editor to run Prettier automatically when you save a file. Also, don't forget the Svelte Prettier plugin.

Nymph.js uses [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for commit messages, and Husky will lint your commit messages when you commit. Please follow the conventional commits format for you commit messages. Please also provide meaningful, informative messages.

Once you've made your change, feel free to open a pull request.

Happy coding, and thanks again for contributing!
