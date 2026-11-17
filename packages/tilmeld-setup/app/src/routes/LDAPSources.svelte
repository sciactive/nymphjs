{#if $clientConfig == null || $user == null}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else}
  <div class="solo-search-container solo-container">
    <Fab
      href="/ldapsources/edit/+"
      use={[link]}
      color="primary"
      mini
      class="solo-fab"
      title="New LDAP Source"
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
        placeholder="LDAP Source Search"
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
    {#if entitiesSearching}
      <div style="display: flex; justify-content: center; align-items: center;">
        <CircularProgress style="height: 32px; width: 32px;" indeterminate />
      </div>
    {:else if entities != null}
      <DataTable table$aria-label="LDAP Source list" style="width: 100%;">
        <Head>
          <Row>
            <Cell>Host</Cell>
            <Cell>Bind Username</Cell>
            <Cell>Search Base</Cell>
            <Cell>Enabled</Cell>
          </Row>
        </Head>
        <Body>
          {#each entities as curEntity (curEntity.guid)}
            <Row>
              <Cell
                ><a
                  href="/ldapsources/edit/{encodeURIComponent(
                    curEntity.guid || '',
                  )}"
                  use:link>{curEntity.host}</a
                ></Cell
              >
              <Cell
                ><a
                  href="/ldapsources/edit/{encodeURIComponent(
                    curEntity.guid || '',
                  )}"
                  use:link>{curEntity.bindUsername ?? ''}</a
                ></Cell
              >
              <Cell
                ><a
                  href="/ldapsources/edit/{encodeURIComponent(
                    curEntity.guid || '',
                  )}"
                  use:link>{curEntity.searchBase}</a
                ></Cell
              >
              <Cell>{curEntity.enabled ? 'Yes' : 'No'}</Cell>
            </Row>
          {:else}
            <Row>
              <Cell colspan={4}>None found.</Cell>
            </Row>
          {/each}
        </Body>
      </DataTable>
    {/if}
  </section>
{/if}

<script lang="ts">
  import type { Writable } from 'svelte/store';
  import { getContext } from 'svelte';
  import { link, push } from 'svelte-spa-router';
  import { ClientError } from '@nymphjs/client';
  import queryParser from '@nymphjs/query-parser';
  import type { ClientConfig, CurrentUserData } from '@nymphjs/tilmeld-client';
  import type {
    LDAPSource as LDAPSourceClass,
    User as UserClass,
  } from '@nymphjs/tilmeld-client';
  import { mdiMagnify, mdiArrowRight, mdiPlus } from '@mdi/js';
  import CircularProgress from '@smui/circular-progress';
  import Paper from '@smui/paper';
  import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
  import { Input } from '@smui/textfield';
  import Fab from '@smui/fab';
  import type Kitchen from '@smui/snackbar/kitchen';
  import { Icon } from '@smui/common';

  import { nymph, LDAPSource } from '../nymph.js';

  let { params }: { params: { query?: string } } = $props();

  let entitySearch = $derived(params.query ?? '');

  let kitchen = getContext<Promise<Kitchen>>('kitchen');

  const clientConfig =
    getContext<Writable<ClientConfig | undefined>>('clientConfigStore');
  const user =
    getContext<Writable<(UserClass & CurrentUserData) | null | undefined>>(
      'userStore',
    );

  $effect(() => {
    if (params) {
      handleSearchParam();
    }
  });

  async function handleSearchParam() {
    if (params.query && params.query !== '') {
      entitiesSearching = true;
      try {
        const query = queryParser({
          query: params.query,
          entityClass: LDAPSource,
          defaultFields: ['host', 'bindUsername', 'searchBase'],
        });
        entities = await nymph.getEntities(...query);
      } catch (e: any) {
        (await kitchen).push({
          label: e?.message ?? 'An error occurred.',
          props: {
            class: e instanceof ClientError ? 'warning' : 'error',
          },
        });
      }
      entitiesSearching = false;
    }
  }

  let entitiesSearching = $state(false);
  let entities: LDAPSourceClass[] | undefined = $state();
  async function searchEntities() {
    push(`/ldapsources/${encodeURIComponent(entitySearch)}`);
  }
  function entitySearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchEntities();
  }
</script>
