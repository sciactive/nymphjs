{#if clientConfig == null || user == null || loading}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else}
  <div style="display: flex; align-items: center; padding: 12px;">
    <IconButton title="Back" on:click={pop}>
      <Icon component={Svg} viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiArrowLeft} />
      </Icon>
    </IconButton>
    <h2 style="margin: 0px 12px 0px;" class="mdc-typography--headline5">
      Editing {entity.guid ? entity.name : 'New Group'}
    </h2>
  </div>

  {#if entity.user}
    {#await entity.user.$wake() then _user}
      <div style="padding: 12px;" class="mdc-typography--subtitle1">
        Generated primary group for <a
          href="#/users/edit/{encodeURIComponent(entity.user.guid || '')}"
          >{entity.user.name} ({entity.user.username})</a
        >
      </div>
    {/await}
  {/if}

  <TabBar
    tabs={['General', 'Parent', 'Abilities']}
    let:tab
    bind:active={activeTab}
  >
    <Tab {tab}>
      <Label>{tab}</Label>
    </Tab>
  </TabBar>

  <section>
    {#if activeTab === 'General'}
      <LayoutGrid style="padding: 0;">
        {#if entity.user != null}
          <LayoutCell span={12}>
            Some of these fields are not editable, since this group inherits the
            values from its user.
          </LayoutCell>
        {/if}
        <LayoutCell span={4}>
          <div class="mdc-typography--headline6">GUID</div>
          <code>{entity.guid}</code>
        </LayoutCell>
        <LayoutCell span={4}>
          <FormField>
            <Checkbox bind:checked={entity.enabled} />
            <span slot="label">Enabled (Able to give abilities)</span>
          </FormField>
        </LayoutCell>
        <LayoutCell span={4} style="text-align: end;">
          <a href="https://en.gravatar.com/" target="_blank" rel="noreferrer">
            <img src={avatar} alt="Avatar" title="Avatar by Gravatar" />
          </a>
        </LayoutCell>
        {#if !clientConfig.emailUsernames}
          <LayoutCell span={6}>
            <Textfield
              bind:value={entity.groupname}
              label="Groupname"
              type="text"
              style="width: 100%;"
              helperLine$style="width: 100%;"
              invalid={groupnameVerified === false}
              input$autocomplete="off"
              input$autocapitalize="off"
              input$spellcheck="false"
              disabled={entity.user != null}
            >
              <HelperText persistent slot="helper">
                {groupnameVerifiedMessage ?? ''}
              </HelperText>
            </Textfield>
          </LayoutCell>
        {/if}
        <LayoutCell span={clientConfig.emailUsernames ? 12 : 6}>
          <Textfield
            bind:value={entity.email}
            label="Email"
            type="email"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={emailVerified === false}
            input$autocomplete="off"
            input$autocapitalize="off"
            input$spellcheck="false"
            disabled={entity.user != null}
          >
            <HelperText persistent slot="helper">
              {emailVerifiedMessage ?? ''}
            </HelperText>
          </Textfield>
        </LayoutCell>
        <LayoutCell span={12}>
          <Textfield
            bind:value={entity.name}
            label="Display Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
            disabled={entity.user != null}
          />
        </LayoutCell>
        <LayoutCell span={8}>
          <Textfield
            bind:value={entity.avatar}
            label="Avatar"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
            disabled={entity.user != null}
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={entity.phone}
            label="Phone"
            type="tel"
            style="width: 100%;"
            input$autocomplete="off"
            disabled={entity.user != null}
          />
        </LayoutCell>
        <LayoutCell span={12}>
          <FormField>
            <Checkbox bind:checked={entity.defaultPrimary} />
            <span slot="label"
              >Default primary group for newly registered users. <small
                class="form-text text-muted"
                >Setting this will unset any current default primary group.</small
              ></span
            >
          </FormField>
        </LayoutCell>
        <LayoutCell span={12}>
          <FormField>
            <Checkbox bind:checked={entity.defaultSecondary} />
            <span slot="label"
              >Default secondary group for newly registered{clientConfig.verifyEmail &&
              clientConfig.unverifiedAccess
                ? ', verified'
                : ''} users.</span
            >
          </FormField>
        </LayoutCell>
        {#if clientConfig.verifyEmail && clientConfig.unverifiedAccess}
          <LayoutCell span={12}>
            <FormField>
              <Checkbox bind:checked={entity.unverifiedSecondary} />
              <span slot="label"
                >Default secondary group for newly registered, unverified users.</span
              >
            </FormField>
          </LayoutCell>
        {/if}
      </LayoutGrid>
    {/if}

    {#if activeTab === 'Parent'}
      <h5 style="margin-top: 0;">Parent</h5>

      <Paper
        style="display: flex; justify-content: space-between; align-items: center;"
      >
        {#if !entity.parent}
          No parent
        {:else}
          <a href="#/groups/edit/{encodeURIComponent(entity.parent.guid || '')}"
            >{entity.parent.name + ' (' + entity.parent.groupname + ')'}</a
          >

          <IconButton
            on:click={() => {
              delete entity.parent;
              entity = entity;
            }}
          >
            <Icon component={Svg} viewBox="0 0 24 24">
              <path fill="currentColor" d={mdiMinus} />
            </Icon>
          </IconButton>
        {/if}
      </Paper>

      <h6>Change Parent</h6>

      <div class="solo-search-container solo-container">
        <Paper class="solo-paper" elevation={1}>
          <Icon class="solo-icon" component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiMagnify} />
          </Icon>
          <Input
            bind:value={parentSearch}
            on:keydown={parentSearchKeyDown}
            placeholder="Parent Search"
            class="solo-input"
          />
        </Paper>
        <IconButton
          on:click={searchParents}
          disabled={parentSearch === ''}
          class="solo-fab"
          title="Search"
        >
          <Icon component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiArrowRight} />
          </Icon>
        </IconButton>
      </div>

      {#if parentsSearching}
        <div
          style="display: flex; justify-content: center; align-items: center;"
        >
          <CircularProgress style="height: 32px; width: 32px;" indeterminate />
        </div>
      {:else if parents != null}
        <DataTable table$aria-label="Parent list" style="width: 100%;">
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
            <!-- Purposefully not making these links. -->
            {#each parents as curEntity (curEntity.guid)}
              <Row
                on:click={() => (entity.parent = curEntity)}
                style="cursor: pointer;"
              >
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
    {/if}

    {#if activeTab === 'Abilities'}
      <h5 style="margin-top: 0;">Abilities</h5>

      <List nonInteractive>
        {#if entity.abilities}
          {#each entity.abilities as ability, index (ability)}
            <Item>
              <Text>
                {ability}
              </Text>
              <Meta>
                <IconButton
                  on:click={() => {
                    entity.abilities?.splice(index, 1);
                    entity = entity;
                  }}
                >
                  <Icon component={Svg} viewBox="0 0 24 24">
                    <path fill="currentColor" d={mdiMinus} />
                  </Icon>
                </IconButton>
              </Meta>
            </Item>
          {:else}
            <Item>
              <Text>No abilities</Text>
            </Item>
          {/each}
        {/if}
      </List>

      <h6>Add Ability</h6>

      <div style="display: flex; align-items: center; flex-wrap: wrap;">
        <Textfield
          bind:value={ability}
          label="Ability"
          type="text"
          style="width: 250px; max-width: 100%;"
          on:keydown={abilityKeyDown}
        />
        <IconButton on:click={addAbility}>
          <Icon component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiPlus} />
          </Icon>
        </IconButton>
      </div>
    {/if}

    {#if failureMessage}
      <div class="tilmeld-failure">
        {failureMessage}
      </div>
    {/if}

    <div style="margin-top: 36px;">
      <Button variant="raised" on:click={saveEntity} disabled={saving}>
        <Label>Save Group</Label>
      </Button>
      {#if entity.guid}
        <Button on:click={deleteEntity} disabled={saving}>
          <Label>Delete</Label>
        </Button>
      {/if}
      {#if success}
        <span>Successfully saved!</span>
      {/if}
    </div>
  </section>
{/if}

<script lang="ts">
  import { onMount } from 'svelte';
  import { pop, replace } from 'svelte-spa-router';
  import type {
    AdminGroupData,
    ClientConfig,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import type {
    Group as GroupClass,
    User as UserClass,
  } from '@nymphjs/tilmeld-client';
  import queryParser from '@nymphjs/query-parser';
  import {
    mdiArrowLeft,
    mdiArrowRight,
    mdiMagnify,
    mdiMinus,
    mdiPlus,
  } from '@mdi/js';
  import CircularProgress from '@smui/circular-progress';
  import Tab from '@smui/tab';
  import TabBar from '@smui/tab-bar';
  import LayoutGrid, { Cell as LayoutCell } from '@smui/layout-grid';
  import FormField from '@smui/form-field';
  import Checkbox from '@smui/checkbox';
  import List, { Item, Text, Meta } from '@smui/list';
  import Paper from '@smui/paper';
  import DataTable, { Head, Body, Row, Cell } from '@smui/data-table';
  import Textfield, { Input } from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import IconButton from '@smui/icon-button';
  import Button from '@smui/button';
  import { Icon, Label, Svg } from '@smui/common';

  import { nymph, Group, User } from '../nymph';

  export let params: { guid: string };

  let entity: GroupClass & AdminGroupData;
  let clientConfig: ClientConfig | undefined = undefined;
  let user: (UserClass & CurrentUserData) | undefined = undefined;
  let activeTab: 'General' | 'Parent' | 'Abilities' = 'General';
  let parentSearch = '';
  let ability = '';
  let avatar = 'https://secure.gravatar.com/avatar/?d=mm&s=40';
  let failureMessage: string | undefined = undefined;
  let groupnameTimer: NodeJS.Timeout | undefined = undefined;
  let groupnameVerified: boolean | undefined = undefined;
  let groupnameVerifiedMessage: string | undefined = undefined;
  let emailTimer: NodeJS.Timeout | undefined = undefined;
  let emailVerified: boolean | undefined = undefined;
  let emailVerifiedMessage: string | undefined = undefined;
  let saving = false;
  let success: boolean | undefined = undefined;
  let loading = true;

  $: if (params) {
    handleGuidParam();
  }

  onMount(async () => {
    user = (await User.current()) ?? undefined;
  });
  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  async function handleGuidParam() {
    loading = true;
    failureMessage = undefined;
    try {
      entity =
        params.guid === '+' || params.guid === ' ' || params.guid === '%20'
          ? await Group.factory()
          : await Group.factory(params.guid);
      oldGroupname = entity.groupname;
      oldEmail = entity.email;
      await readyEntity();
    } catch (e: any) {
      failureMessage = e.message;
    }
    loading = false;
  }

  async function readyEntity() {
    // Make sure all fields are defined.
    if (entity.enabled == null) {
      entity.enabled = false;
    }
    if (entity.groupname == null) {
      entity.groupname = '';
    }
    if (entity.email == null) {
      entity.email = '';
    }
    if (entity.name == null) {
      entity.name = '';
    }
    if (entity.avatar == null) {
      entity.avatar = '';
    }
    if (entity.phone == null) {
      entity.phone = '';
    }
    if (entity.defaultPrimary == null) {
      entity.defaultPrimary = false;
    }
    if (entity.defaultSecondary == null) {
      entity.defaultSecondary = false;
    }
    if (entity.unverifiedSecondary == null) {
      entity.unverifiedSecondary = false;
    }
    avatar = await entity.$getAvatar();
    await entity.$wakeAll(1);
    entity = entity;
  }

  let parentsSearching = false;
  let parents: (GroupClass & AdminGroupData)[] | undefined = undefined;
  async function searchParents() {
    parentsSearching = true;
    failureMessage = undefined;
    if (parentSearch.trim() == '') {
      return;
    }
    try {
      const query = queryParser({
        query: parentSearch,
        entityClass: Group,
        defaultFields: ['groupname', 'name', 'email'],
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
      parents = (await nymph.getEntities(...query)).filter((group) => {
        return !group.$is(entity) && !group.$is(entity.parent);
      });
    } catch (e: any) {
      failureMessage = e?.message;
    }
    parentsSearching = false;
  }
  function parentSearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchParents();
  }

  let oldGroupname: string | undefined = undefined;
  $: if (entity && entity.groupname !== oldGroupname) {
    if (groupnameTimer) {
      clearTimeout(groupnameTimer);
    }
    groupnameTimer = setTimeout(async () => {
      if (entity.groupname === '') {
        groupnameVerified = undefined;
        groupnameVerifiedMessage = undefined;
        return;
      }
      try {
        const data = await entity.$checkGroupname();
        groupnameVerified = data.result;
        groupnameVerifiedMessage = data.message;
      } catch (e: any) {
        groupnameVerified = false;
        groupnameVerifiedMessage = e?.message;
      }
    }, 400);
    oldGroupname = entity.groupname;
  }

  let oldEmail: string | undefined = undefined;
  $: if (entity && entity.email !== oldEmail) {
    if (emailTimer) {
      clearTimeout(emailTimer);
    }
    emailTimer = setTimeout(async () => {
      if (entity.email === '') {
        emailVerified = undefined;
        emailVerifiedMessage = undefined;
        return;
      }
      try {
        const data = await entity.$checkEmail();
        emailVerified = data.result;
        emailVerifiedMessage = data.message;
      } catch (e: any) {
        emailVerified = false;
        emailVerifiedMessage = e?.message;
      }
    }, 400);
    oldEmail = entity.email;
  }

  function addAbility() {
    if (ability === '') {
      return;
    }
    failureMessage = undefined;
    if (ability === 'system/admin') {
      failureMessage = "Groups aren't allowed to be system admins.";
      return;
    }
    if (ability === 'tilmeld/admin') {
      failureMessage = "Groups aren't allowed to be Tilmeld admins.";
      return;
    }
    if (ability === 'tilmeld/switch') {
      failureMessage = "Groups aren't allowed to have switch user ability.";
      return;
    }
    entity.abilities?.push(ability);
    ability = '';
    entity = entity;
  }
  function abilityKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') addAbility();
  }

  async function saveEntity() {
    saving = true;
    failureMessage = undefined;
    const newEntity = entity.guid == null;
    try {
      if (await entity.$save()) {
        await readyEntity();
        success = true;
        if (newEntity) {
          replace(`/groups/edit/${encodeURIComponent(entity.guid || '')}`);
        }
        setTimeout(() => {
          success = undefined;
        }, 1000);
      } else {
        failureMessage = 'Error saving group.';
      }
    } catch (e: any) {
      console.log('error:', e);
      failureMessage = e?.message;
    }
    saving = false;
  }

  async function deleteEntity() {
    failureMessage = undefined;
    if (confirm('Are you sure you want to delete this?')) {
      saving = true;
      try {
        if (await entity.$delete()) {
          pop();
        } else {
          failureMessage = 'An error occurred.';
        }
      } catch (e: any) {
        failureMessage = e?.message;
      }
      saving = false;
    }
  }
</script>
