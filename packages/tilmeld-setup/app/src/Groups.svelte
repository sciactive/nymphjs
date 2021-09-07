{#if clientConfig == null || user == null}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else if entity == null}
  <div class="solo-search-container solo-container">
    <Fab
      on:click={async () => (entity = await Group.factory())}
      color="primary"
      mini
      class="solo-fab"
      title="New Group"
    >
      <Icon component={Svg} viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiPlus} />
      </Icon>
    </Fab>
    <Paper class="solo-paper" elevation={6}>
      <Icon class="solo-icon" component={Svg} viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiMagnify} />
      </Icon>
      <Input
        bind:value={entitySearch}
        on:keydown={entitySearchKeyDown}
        placeholder="Group Search"
        class="solo-input"
      />
    </Paper>
    <Fab
      on:click={searchEntities}
      disabled={entitySearch === ''}
      color="primary"
      mini
      class="solo-fab"
      title="Search"
    >
      <Icon component={Svg} viewBox="0 0 24 24">
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
      <DataTable table$aria-label="Group list" style="width: 100%;">
        <Head>
          <Row>
            {#if !clientConfig.emailUsernames}
              <Cell>Groupname</Cell>
            {/if}
            <Cell>Name</Cell>
            <Cell>Email</Cell>
            <Cell>Enabled</Cell>
          </Row>
        </Head>
        <Body>
          {#each entities as curEntity (curEntity.guid)}
            <Row on:click={() => (entity = curEntity)} style="cursor: pointer;">
              {#if !clientConfig.emailUsernames}
                <Cell>{curEntity.groupname}</Cell>
              {/if}
              <Cell>{curEntity.name}</Cell>
              <Cell>{curEntity.email}</Cell>
              <Cell>{curEntity.enabled ? 'Yes' : 'No'}</Cell>
            </Row>
          {/each}
        </Body>
      </DataTable>
    {/if}
  </section>
{:else}
  <GroupEdit
    {entity}
    on:leave={() => {
      entity = null;
    }}
  />
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { Nymph } from '@nymphjs/client';
  import queryParser from '@nymphjs/query-parser';
  import {
    AdminGroupData,
    ClientConfig,
    CurrentUserData,
    Group,
    User,
  } from '@nymphjs/tilmeld-client';
  import { mdiMagnify, mdiArrowRight, mdiPlus } from '@mdi/js';
  import CircularProgress from '@smui/circular-progress';
  import Paper from '@smui/paper';
  import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
  import { Input } from '@smui/textfield';
  import Fab from '@smui/fab';
  import { Icon } from '@smui/common';
  import Svg from '@smui/common/Svg.svelte';

  import GroupEdit from './GroupEdit.svelte';

  let clientConfig: ClientConfig | null = null;
  let user: (User & CurrentUserData) | null = null;
  let entitySearch = '';
  let failureMessage: string | null = null;

  let entity: (Group & AdminGroupData) | null = null;

  onMount(async () => {
    user = await User.current();
  });
  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  let entitiesSearching = false;
  let entities: (Group & AdminGroupData)[] | null = null;
  async function searchEntities() {
    entitiesSearching = true;
    failureMessage = null;
    try {
      const query = queryParser(
        entitySearch,
        Group,
        ['username', 'name', 'email'],
        {
          User: {
            class: User,
            defaultFields: ['username', 'name', 'email'],
          },
          Group: {
            class: Group,
            defaultFields: ['groupname', 'name', 'email'],
          },
        }
      );
      entities = await Nymph.getEntities(...query);
    } catch (e: any) {
      failureMessage = e?.message;
    }
    entitiesSearching = false;
  }
  function entitySearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') searchEntities();
  }
</script>
