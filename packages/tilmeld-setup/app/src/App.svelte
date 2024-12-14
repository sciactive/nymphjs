<svelte:window onresize={setMiniWindow} />

<TopAppBar variant="static" class="tilmeld-top-app-bar">
  <Row>
    <Section>
      {#if miniWindow}
        <IconButton
          class="material-icons"
          onclick={() => (drawerOpen = !drawerOpen)}>menu</IconButton
        >
      {/if}
      <Title style={miniWindow ? 'padding-left: 0;' : ''}>
        {miniWindow ? 'Tilmeld Setup' : 'Tilmeld Setup App'}
      </Title>
    </Section>
    <Section align="end" toolbar style="color: var(--mdc-on-surface, #000);">
      <IconButton
        href="https://github.com/sciactive/nymphjs"
        target="_blank"
        rel="noreferrer"
        title="Nymph/Tilmeld on GitHub"
      >
        <Icon tag="svg" viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiGithub} />
        </Icon>
      </IconButton>
      <IconButton
        href="https://port87.social/@hperrin"
        target="_blank"
        rel="noreferrer"
        title="SciActive on Mastodon"
      >
        <Icon tag="svg" viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiMastodon} />
        </Icon>
      </IconButton>
      <div>
        <IconButton
          title="Account"
          onclick={() => $user != null && accountMenu.setOpen(true)}
        >
          <Icon tag="img" src={userAvatar} />
        </IconButton>
        <Menu bind:this={accountMenu} anchorCorner="BOTTOM_LEFT">
          <List>
            <Item onSMUIAction={() => (accountOpen = true)}>
              <Text>Account Details</Text>
            </Item>
            <Separator />
            <Item onSMUIAction={() => $user?.$logout()}>
              <Text>Logout</Text>
            </Item>
          </List>
        </Menu>
      </div>
    </Section>
  </Row>
</TopAppBar>
<div class="drawer-container">
  <Drawer
    variant={miniWindow ? 'modal' : undefined}
    bind:open={drawerOpen}
    class="tilmeld-drawer mdc-theme--secondary-bg {miniWindow
      ? 'tilmeld-drawer-adjust'
      : 'hide-initial-small'}"
  >
    <Content>
      <List tag="div">
        {#if tilmeldAdmin}
          {#each sections as section (section.name)}
            {#if 'separator' in section}
              <Separator />
            {:else}
              <Item
                bind:this={section.component}
                tag="a"
                nonInteractive={!('href' in section)}
                href={'href' in section ? `#${section.href}` : undefined}
                activated={section.absolute
                  ? `${currentMatch.route.path}/` === section.href
                  : `${currentMatch.route.path}/`.startsWith(
                      section.href ?? '!',
                    )}
                style={section.indent
                  ? 'margin-left: ' + section.indent * 25 + 'px;'
                  : ''}
              >
                <Text class="mdc-theme--on-secondary">{section.name}</Text>
              </Item>
            {/if}
          {/each}
        {:else if $user == null}
          <Item tag="span" onclick={() => (drawerOpen = false)} activated>
            <Text class="mdc-theme--on-secondary">Login</Text>
          </Item>
        {:else}
          <Item tag="span" onclick={() => (drawerOpen = false)} activated>
            <Text class="mdc-theme--on-secondary">Forbidden</Text>
          </Item>
        {/if}
      </List>
    </Content>
  </Drawer>

  {#if miniWindow}
    <Scrim />
  {/if}
  <AppContent class="tilmeld-app-content">
    <main class="tilmeld-main-content" bind:this={mainContent}>
      {#if tilmeldAdmin}
        {#if $clientConfig}
          <CurrentRoute {router} {params} {clientConfig} {user} />
        {:else}
          Loading...
        {/if}
      {:else if $user === null}
        <section style="display: flex; justify-content: center;">
          <Login
            {User}
            {clientConfig}
            showExistingUserToggle={allowRegistration}
          />
        </section>
      {:else if $user === undefined}
        Loading...
      {:else}
        <section>You don't have permission to access this app.</section>
      {/if}
      <Account bind:open={accountOpen} {User} {user} {clientConfig} />
    </main>
  </AppContent>
</div>

<script lang="ts">
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import Navigo from 'navigo';
  import type {
    User as UserClass,
    ClientConfig,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import { Login, Account } from '@nymphjs/tilmeld-components';
  import { mdiGithub, mdiMastodon } from '@mdi/js';
  import TopAppBar, { Row, Section, Title } from '@smui/top-app-bar';
  import Drawer, { Content, Scrim, AppContent } from '@smui/drawer';
  import IconButton from '@smui/icon-button';
  import List, { Item, Text, Separator } from '@smui/list';
  import Menu from '@smui/menu';
  import { Icon } from '@smui/common';

  import { User } from './nymph';
  import Intro from './routes/Intro.svelte';
  import Users from './routes/Users.svelte';
  import UserEdit from './routes/UserEdit.svelte';
  import Groups from './routes/Groups.svelte';
  import GroupEdit from './routes/GroupEdit.svelte';
  import NotFound from './routes/NotFound.svelte';

  const DEFAULT_AVATAR = 'https://secure.gravatar.com/avatar/?d=mm&s=40';
  const allowRegistration = (window as any).allowRegistration;

  let mainContent: HTMLElement;
  let miniWindow = $state(false);
  let drawerOpen = $state(false);
  let accountMenu: any;
  let clientConfig: Writable<ClientConfig | undefined> = writable();
  let user: Writable<(UserClass & CurrentUserData) | null | undefined> =
    writable();
  let userAvatar: string = $state(DEFAULT_AVATAR);
  let tilmeldAdmin: boolean | undefined = $state();
  let accountOpen = $state(false);

  $effect(() => {
    if ($user) {
      $user
        .$gatekeeper('tilmeld/admin')
        .then((value) => (tilmeldAdmin = value));
      $user.$getAvatar().then((value) => (userAvatar = value));
    } else {
      tilmeldAdmin = undefined;
      userAvatar = DEFAULT_AVATAR;
    }
  });

  const router = new Navigo('/', { hash: true });
  let CurrentRoute: Component<any> = $state(Intro);
  let params: any = $state({});

  router.hooks({
    before(done, match) {
      if (mainContent) {
        drawerOpen = false;
        mainContent.scrollTop = 0;
      }

      currentMatch = match;

      done();
    },
  });

  router.on({
    '/': () => {
      CurrentRoute = Intro;
      params = {};
    },
    '/users/edit/:guid': ({ data }: any) => {
      CurrentRoute = UserEdit;
      params = data;
    },
    '/users/': () => {
      CurrentRoute = Users;
      params = {};
    },
    '/users/:query?': ({ data }: any) => {
      CurrentRoute = Users;
      params = data;
    },
    '/groups/edit/:guid': ({ data }: any) => {
      CurrentRoute = GroupEdit;
      params = data;
    },
    '/groups/': () => {
      CurrentRoute = Groups;
      params = {};
    },
    '/groups/:query?': ({ data }: any) => {
      CurrentRoute = Groups;
      params = data;
    },
  });

  router.notFound(({ hashString }: any) => {
    if (hashString === '') {
      router.navigate('/', { historyAPIMethod: 'replaceState' });
    } else {
      CurrentRoute = NotFound;
      params = {};
    }
  });

  let currentMatch = $state(router.getCurrentLocation());
  router.resolve();

  const sections: (
    | {
        name: string;
        indent: number;
        href?: string;
        absolute?: boolean;
        component?: ReturnType<Component<any>>;
      }
    | { name: string; separator: true }
  )[] = [
    {
      name: 'Introduction',
      href: '/',
      absolute: true,
      indent: 0,
    },
    {
      name: 'sep1',
      separator: true,
    },
    {
      name: 'Users',
      href: 'users/',
      indent: 0,
    },
    {
      name: 'Groups',
      href: 'groups/',
      indent: 0,
    },
  ];

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    $user = currentUser;
  };
  const onLogout = () => {
    $user = null;
  };

  onMount(setMiniWindow);
  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);

    $clientConfig = await User.getClientConfig();

    $user = await User.current();
  });

  function setMiniWindow() {
    if (typeof window !== 'undefined') {
      miniWindow = window.innerWidth < 720;
    }
  }
</script>

<style>
  @media (max-width: 720px) {
    :global(* > .hide-initial-small) {
      display: none;
    }
  }
</style>
