<svelte:window on:resize={setMiniWindow} />
<TopAppBar variant="static" class="tilmeld-top-app-bar">
  <Row>
    <Section>
      {#if miniWindow}
        <IconButton
          class="material-icons"
          on:click={() => (drawerOpen = !drawerOpen)}>menu</IconButton
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
        <Icon component={Svg} viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiGithub} />
        </Icon>
      </IconButton>
      <IconButton
        href="https://port87.social/@hperrin"
        target="_blank"
        rel="noreferrer"
        title="SciActive on Mastodon"
      >
        <Icon component={Svg} viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiMastodon} />
        </Icon>
      </IconButton>
      <IconButton
        href="https://twitter.com/SciActive"
        target="_blank"
        rel="noreferrer"
        title="SciActive on Twitter"
      >
        <Icon component={Svg} viewBox="0 0 24 24">
          <path fill="currentColor" d={mdiTwitter} />
        </Icon>
      </IconButton>
      <div>
        <IconButton
          title="Account"
          on:click={() => user != null && accountMenu.setOpen(true)}
        >
          <Icon tag="img" src={userAvatar} />
        </IconButton>
        <Menu bind:this={accountMenu} anchorCorner="BOTTOM_LEFT">
          <List>
            <Item on:SMUI:action={() => (accountOpen = true)}>
              <Text>Account Details</Text>
            </Item>
            <Separator />
            <Item on:SMUI:action={() => user?.$logout()}>
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
      <List>
        {#if tilmeldAdmin}
          {#each sections as section (section.name)}
            {#if 'separator' in section}
              <Separator />
            {:else}
              <Item
                bind:this={section.component}
                nonInteractive={!('route' in section)}
                on:click={() => {
                  if ('route' in section) {
                    active = section.route ?? Intro;
                  }
                }}
                activated={active === section.route}
                style={section.indent
                  ? 'margin-left: ' + section.indent * 25 + 'px;'
                  : ''}
              >
                <Text class="mdc-theme--on-secondary">{section.name}</Text>
              </Item>
            {/if}
          {/each}
        {:else if user == null}
          <Item on:click={() => (drawerOpen = false)} activated>
            <Text class="mdc-theme--on-secondary">Login</Text>
          </Item>
        {:else}
          <Item on:click={() => (drawerOpen = false)} activated>
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
        {#if clientConfig}
          <svelte:component this={active} />
        {:else}
          Loading...
        {/if}
      {:else if user == null}
        <section style="display: flex; justify-content: center;">
          <Login {User} {clientConfig} />
        </section>
      {:else}
        <section>You don't have permission to access this app.</section>
      {/if}
      <Account bind:open={accountOpen} {User} {clientConfig} />
    </main>
  </AppContent>
</div>

<script lang="ts">
  import { onMount, SvelteComponent } from 'svelte';
  import type {
    User as UserClass,
    ClientConfig,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import { Login, Account } from '@nymphjs/tilmeld-components';
  import { mdiGithub, mdiMastodon, mdiTwitter } from '@mdi/js';
  import TopAppBar, { Row, Section, Title } from '@smui/top-app-bar';
  import Drawer, { Content, Scrim, AppContent } from '@smui/drawer';
  import IconButton from '@smui/icon-button';
  import List, { Item, Text, Separator } from '@smui/list';
  import Menu from '@smui/menu';
  import { Icon, Svg } from '@smui/common';

  import { User } from './nymph';
  import Intro from './Intro.svelte';
  import Users from './Users.svelte';
  import Groups from './Groups.svelte';
  import type { SvelteComponentDev } from 'svelte/internal';

  const DEFAULT_AVATAR = 'https://secure.gravatar.com/avatar/?d=mm&s=40';

  let mainContent: HTMLElement;
  let miniWindow = false;
  let drawerOpen = false;
  let accountMenu: any;
  let active: typeof SvelteComponentDev = Intro;
  let clientConfig: ClientConfig;
  let user: (UserClass & CurrentUserData) | undefined = undefined;
  let userAvatar: string = DEFAULT_AVATAR;
  let tilmeldAdmin: boolean | undefined = undefined;
  let accountOpen = false;

  $: if (active && mainContent) {
    drawerOpen = false;
    mainContent.scrollTop = 0;
  }

  $: if (user) {
    user.$gatekeeper('tilmeld/admin').then((value) => (tilmeldAdmin = value));
    user.$getAvatar().then((value) => (userAvatar = value));
  } else {
    tilmeldAdmin = undefined;
    userAvatar = DEFAULT_AVATAR;
  }

  const sections: (
    | {
        name: string;
        indent: number;
        route?: typeof SvelteComponentDev;
        component?: SvelteComponent;
      }
    | { name: string; separator: true }
  )[] = [
    {
      name: 'Introduction',
      route: Intro,
      indent: 0,
    },
    {
      name: 'sep1',
      separator: true,
    },
    {
      name: 'Users',
      route: Users,
      indent: 0,
    },
    {
      name: 'Groups',
      route: Groups,
      indent: 0,
    },
  ];

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    user = currentUser;
  };
  const onLogout = () => {
    user = undefined;
  };

  onMount(setMiniWindow);
  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    user = (await User.current()) ?? undefined;
  });
  onMount(async () => {
    clientConfig = await User.getClientConfig();
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
