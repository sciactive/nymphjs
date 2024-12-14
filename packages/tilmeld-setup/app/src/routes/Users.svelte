{#if $clientConfig == null || $user == null}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else}
  <div class="solo-search-container solo-container">
    <Fab
      href="#/users/edit/+"
      color="primary"
      mini
      class="solo-fab"
      title="New User"
    >
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiPlus} />
      </Icon>
    </Fab>
    <Paper class="solo-paper" elevation={6}>
      <Icon class="solo-icon" tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiMagnify} />
      </Icon>
      <Input
        bind:value={entitySearch}
        onkeydown={entitySearchKeyDown}
        placeholder="User Search"
        class="solo-input"
      />
    </Paper>
    <Fab
      onclick={searchEntities}
      disabled={entitySearch === ''}
      color="primary"
      mini
      class="solo-fab"
      title="Search"
    >
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiArrowRight} />
      </Icon>
    </Fab>
  </div>
  <section>
    {#if failureMessage}
      <div class="tilmeld-failure">
        {failureMessage}
      </div>
    {/if}

    {#if entitiesSearching}
      <div style="display: flex; justify-content: center; align-items: center;">
        <CircularProgress style="height: 32px; width: 32px;" indeterminate />
      </div>
    {:else if entities != null}
      <DataTable table$aria-label="User list" style="width: 100%;">
        <Head>
          <Row>
            {#if !$clientConfig.emailUsernames}
              <Cell>Username</Cell>
            {/if}
            {#if $clientConfig.userFields.includes('name')}
              <Cell>Name</Cell>
            {/if}
            {#if $clientConfig.userFields.includes('email')}
              <Cell>Email</Cell>
            {/if}
            <Cell>Enabled</Cell>
          </Row>
        </Head>
        <Body>
          {#each entities as curEntity (curEntity.guid)}
            <Row>
              {#if !$clientConfig.emailUsernames}
                <Cell
                  ><a
                    href="#/users/edit/{encodeURIComponent(
                      curEntity.guid || '',
                    )}">{curEntity.username}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('name')}
                <Cell
                  ><a
                    href="#/users/edit/{encodeURIComponent(
                      curEntity.guid || '',
                    )}">{curEntity.name}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('email')}
                <Cell
                  ><a
                    href="#/users/edit/{encodeURIComponent(
                      curEntity.guid || '',
                    )}">{curEntity.email}</a
                  ></Cell
                >
              {/if}
              <Cell>{curEntity.enabled ? 'Yes' : 'No'}</Cell>
            </Row>
          {:else}
            <Row>
              <Cell
                colspan={1 +
                  (!$clientConfig.emailUsernames ? 1 : 0) +
                  ($clientConfig.userFields.includes('name') ? 1 : 0) +
                  ($clientConfig.userFields.includes('email') ? 1 : 0)}
                >None found.</Cell
              >
            </Row>
          {/each}
        </Body>
      </DataTable>
    {/if}
  </section>
{/if}

<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type Navigo from 'navigo';
  import queryParser from '@nymphjs/query-parser';
  import type {
    AdminUserData,
    ClientConfig,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import type {
    Group as GroupClass,
    User as UserClass,
  } from '@nymphjs/tilmeld-client';
  import { mdiMagnify, mdiArrowRight, mdiPlus } from '@mdi/js';
  import CircularProgress from '@smui/circular-progress';
  import Paper from '@smui/paper';
  import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
  import { Input } from '@smui/textfield';
  import Fab from '@smui/fab';
  import { Icon } from '@smui/common';

  import { nymph, User, Group } from '../nymph';

  let {
    router,
    params,
    clientConfig,
    user,
  }: {
    router: Navigo;
    params: { query?: string };
    clientConfig: Writable<ClientConfig | undefined>;
    user: Writable<(UserClass & CurrentUserData) | null | undefined>;
  } = $props();

  let entitySearch = $state(params.query ?? '');
  let failureMessage: string | undefined = $state();

  $effect(() => {
    if (params) {
      handleSearchParam();
    }
  });

  async function handleSearchParam() {
    if (params.query && params.query !== '') {
      entitiesSearching = true;
      failureMessage = undefined;
      try {
        const query = queryParser({
          query: params.query,
          entityClass: User,
          defaultFields: ['username', 'name', 'email'],
          qrefMap: {
            User: {
              class: User,
              defaultFields: ['username', 'name', 'email'],
            },
            Group: {
              class: Group,
              defaultFields: ['groupname', 'name', 'email'],
            },
          },
        });
        entities = await nymph.getEntities(...query);
      } catch (e: any) {
        failureMessage = e?.message;
      }
      entitiesSearching = false;
    }
  }

  let entitiesSearching = $state(false);
  let entities: (UserClass & AdminUserData)[] | undefined = $state();
  async function searchEntities() {
    router.navigate(`/users/${encodeURIComponent(entitySearch)}`);
  }
  function entitySearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchEntities();
  }
</script>
