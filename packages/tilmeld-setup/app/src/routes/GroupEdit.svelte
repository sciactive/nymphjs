{#if $clientConfig == null || $user == null || loading}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else}
  <div style="display: flex; align-items: center; padding: 12px;">
    <IconButton
      title="Back"
      onclick={() => router.navigate('', { historyAPIMethod: 'back' })}
    >
      <Icon tag="svg" viewBox="0 0 24 24">
        <path fill="currentColor" d={mdiArrowLeft} />
      </Icon>
    </IconButton>
    <h2 style="margin: 0px 12px 0px;" class="mdc-typography--headline5">
      Editing {$entity.guid ? ($entity.name ?? $entity.groupname) : 'New Group'}
    </h2>
  </div>

  {#if $entity.user}
    {#await $entity.user.$wake() then _user}
      <div style="padding: 12px;" class="mdc-typography--subtitle1">
        Generated primary group for <a
          href="#/users/edit/{encodeURIComponent($entity.user.guid || '')}"
          >{$clientConfig.userFields.includes('name')
            ? $entity.user.name + ' (' + $entity.user.username + ')'
            : $entity.user.username}</a
        >
      </div>
    {/await}
  {/if}

  <TabBar tabs={['General', 'Parent', 'Abilities']} bind:active={activeTab}>
    {#snippet tab(tab)}
      <Tab {tab}>
        <Label>{tab}</Label>
      </Tab>
    {/snippet}
  </TabBar>

  <section>
    {#if activeTab === 'General'}
      <LayoutGrid style="padding: 0;">
        {#if $entity.user != null}
          <LayoutCell span={12}>
            Some of these fields are not editable, since this group inherits the
            values from its user.
          </LayoutCell>
        {/if}
        <LayoutCell span={4}>
          <div class="mdc-typography--headline6">GUID</div>
          <code>{$entity.guid}</code>
        </LayoutCell>
        <LayoutCell span={4}>
          <FormField>
            <Checkbox bind:checked={$entity.enabled} />
            {#snippet label()}
              Enabled (Able to give abilities)
            {/snippet}
          </FormField>
        </LayoutCell>
        <LayoutCell span={4} style="text-align: end;">
          <a href="https://en.gravatar.com/" target="_blank" rel="noreferrer">
            <img src={avatar} alt="Avatar" title="Avatar by Gravatar" />
          </a>
        </LayoutCell>
        {#if !$clientConfig.emailUsernames}
          <LayoutCell
            span={$clientConfig.userFields.includes('email') ? 6 : 12}
          >
            <Textfield
              bind:value={$entity.groupname}
              label="Groupname"
              type="text"
              style="width: 100%;"
              helperLine$style="width: 100%;"
              invalid={groupnameVerified === false}
              input$autocomplete="off"
              input$autocapitalize="off"
              input$spellcheck="false"
              disabled={$entity.user != null}
            >
              {#snippet helper()}
                <HelperText persistent>
                  {groupnameVerifiedMessage ?? ''}
                </HelperText>
              {/snippet}
            </Textfield>
          </LayoutCell>
        {/if}
        {#if $clientConfig.userFields.includes('email')}
          <LayoutCell span={$clientConfig.emailUsernames ? 12 : 6}>
            <Textfield
              bind:value={$entity.email}
              label="Email"
              type="email"
              style="width: 100%;"
              helperLine$style="width: 100%;"
              invalid={emailVerified === false}
              input$autocomplete="off"
              input$autocapitalize="off"
              input$spellcheck="false"
              disabled={$entity.user != null}
            >
              {#snippet helper()}
                <HelperText persistent>
                  {emailVerifiedMessage ?? ''}
                </HelperText>
              {/snippet}
            </Textfield>
          </LayoutCell>
        {/if}
        {#if $clientConfig.userFields.includes('name')}
          <LayoutCell span={12}>
            <Textfield
              bind:value={$entity.name}
              label="Display Name"
              type="text"
              style="width: 100%;"
              input$autocomplete="off"
              disabled={$entity.user != null}
            />
          </LayoutCell>
        {/if}
        <LayoutCell span={$clientConfig.userFields.includes('phone') ? 8 : 12}>
          <Textfield
            bind:value={$entity.avatar}
            label="Avatar"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
            disabled={$entity.user != null}
          />
        </LayoutCell>
        {#if $clientConfig.userFields.includes('phone')}
          <LayoutCell span={4}>
            <Textfield
              bind:value={$entity.phone}
              label="Phone"
              type="tel"
              style="width: 100%;"
              input$autocomplete="off"
              disabled={$entity.user != null}
            />
          </LayoutCell>
        {/if}
        <LayoutCell span={12}>
          <FormField>
            <Checkbox bind:checked={$entity.defaultPrimary} />
            {#snippet label()}
              Default primary group for newly registered users. <small
                class="form-text text-muted"
                >Setting this will unset any current default primary group.</small
              >
            {/snippet}
          </FormField>
        </LayoutCell>
        <LayoutCell span={12}>
          <FormField>
            <Checkbox bind:checked={$entity.defaultSecondary} />
            {#snippet label()}
              Default secondary group for newly registered{$clientConfig?.userFields.includes(
                'email',
              ) &&
              $clientConfig.verifyEmail &&
              $clientConfig.unverifiedAccess
                ? ', verified'
                : ''} users.
            {/snippet}
          </FormField>
        </LayoutCell>
        {#if $clientConfig.userFields.includes('email') && $clientConfig.verifyEmail && $clientConfig.unverifiedAccess}
          <LayoutCell span={12}>
            <FormField>
              <Checkbox bind:checked={$entity.unverifiedSecondary} />
              {#snippet label()}
                Default secondary group for newly registered, unverified users.
              {/snippet}
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
        {#if !$entity.parent}
          No parent
        {:else}
          <a
            href="#/groups/edit/{encodeURIComponent($entity.parent.guid || '')}"
            >{$clientConfig.userFields.includes('name')
              ? $entity.parent.name + ' (' + $entity.parent.groupname + ')'
              : $entity.parent.groupname}</a
          >

          <IconButton
            onclick={() => {
              delete $entity.parent;
              $entity = $entity;
            }}
          >
            <Icon tag="svg" viewBox="0 0 24 24">
              <path fill="currentColor" d={mdiMinus} />
            </Icon>
          </IconButton>
        {/if}
      </Paper>

      <h6>Change Parent</h6>

      <div class="solo-search-container solo-container">
        <Paper class="solo-paper" elevation={1}>
          <Icon class="solo-icon" tag="svg" viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiMagnify} />
          </Icon>
          <Input
            bind:value={parentSearch}
            onkeydown={parentSearchKeyDown}
            placeholder="Parent Search"
            class="solo-input"
          />
        </Paper>
        <IconButton
          onclick={searchParents}
          disabled={parentSearch === ''}
          class="solo-fab"
          title="Search"
        >
          <Icon tag="svg" viewBox="0 0 24 24">
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
              {#if !$clientConfig.emailUsernames}
                <Cell>Groupname</Cell>
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
            <!-- Purposefully not making these links. -->
            {#each parents as curEntity (curEntity.guid)}
              <Row
                onclick={() => ($entity.parent = curEntity)}
                style="cursor: pointer;"
              >
                {#if !$clientConfig.emailUsernames}
                  <Cell>{curEntity.groupname}</Cell>
                {/if}
                {#if $clientConfig.userFields.includes('name')}
                  <Cell>{curEntity.name}</Cell>
                {/if}
                {#if $clientConfig.userFields.includes('email')}
                  <Cell>{curEntity.email}</Cell>
                {/if}
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
        {#each $entity.abilities || [] as ability, index (ability)}
          <Item>
            <Text>
              {ability}
            </Text>
            <Meta>
              <IconButton
                onclick={() => {
                  $entity.abilities?.splice(index, 1);
                  $entity = $entity;
                }}
              >
                <Icon tag="svg" viewBox="0 0 24 24">
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
      </List>

      <h6>Add Ability</h6>

      <div style="display: flex; align-items: center; flex-wrap: wrap;">
        <Textfield
          bind:value={ability}
          label="Ability"
          type="text"
          style="width: 250px; max-width: 100%;"
          onkeydown={abilityKeyDown}
        />
        <IconButton onclick={addAbility}>
          <Icon tag="svg" viewBox="0 0 24 24">
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
      <Button variant="raised" onclick={saveEntity} disabled={saving}>
        <Label>Save Group</Label>
      </Button>
      {#if $entity.guid}
        <Button onclick={deleteEntity} disabled={saving}>
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
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import type Navigo from 'navigo';
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
  import { Icon, Label } from '@smui/common';

  import { nymph, Group, User } from '../nymph';

  let {
    router,
    params,
    clientConfig,
    user,
  }: {
    router: Navigo;
    params: { guid: string };
    clientConfig: Writable<ClientConfig | undefined>;
    user: Writable<(UserClass & CurrentUserData) | null | undefined>;
  } = $props();

  let entity: Writable<GroupClass & AdminGroupData> = writable(
    Group.factorySync(),
  );
  let activeTab: 'General' | 'Parent' | 'Abilities' = $state('General');
  let parentSearch = $state('');
  let ability = $state('');
  let avatar = $state('https://secure.gravatar.com/avatar/?d=mm&s=40');
  let failureMessage: string | undefined = $state();
  let groupnameTimer: NodeJS.Timeout | undefined = undefined;
  let groupnameVerified: boolean | undefined = $state();
  let groupnameVerifiedMessage: string | undefined = $state();
  let emailTimer: NodeJS.Timeout | undefined = undefined;
  let emailVerified: boolean | undefined = $state();
  let emailVerifiedMessage: string | undefined = $state();
  let saving = $state(false);
  let success: boolean | undefined = $state();
  let loading = $state(true);

  $effect(() => {
    if (params) {
      handleGuidParam();
    }
  });

  async function handleGuidParam() {
    loading = true;
    failureMessage = undefined;
    try {
      $entity =
        params.guid === '+' || params.guid === ' ' || params.guid === '%20'
          ? await Group.factory()
          : await Group.factory(params.guid);
      oldGroupname = $entity.groupname;
      oldEmail = $entity.email;
      await readyEntity();
    } catch (e: any) {
      failureMessage = e.message;
    }
    loading = false;
  }

  async function readyEntity() {
    // Make sure all fields are defined.
    if ($entity.enabled == null) {
      $entity.enabled = false;
    }
    if ($entity.groupname == null) {
      $entity.groupname = '';
    }
    if ($entity.email == null) {
      $entity.email = '';
    }
    if ($entity.name == null) {
      $entity.name = '';
    }
    if ($entity.avatar == null) {
      $entity.avatar = '';
    }
    if ($entity.phone == null) {
      $entity.phone = '';
    }
    if ($entity.defaultPrimary == null) {
      $entity.defaultPrimary = false;
    }
    if ($entity.defaultSecondary == null) {
      $entity.defaultSecondary = false;
    }
    if ($entity.unverifiedSecondary == null) {
      $entity.unverifiedSecondary = false;
    }
    avatar = await $entity.$getAvatar();
    await $entity.$wakeAll(1);
    $entity = $entity;
  }

  let parentsSearching = $state(false);
  let parents: (GroupClass & AdminGroupData)[] | undefined = $state();
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
        return !group.$is($entity) && !group.$is($entity.parent);
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
  $effect(() => {
    if ($entity && $entity.groupname !== oldGroupname) {
      if (groupnameTimer) {
        clearTimeout(groupnameTimer);
      }
      groupnameTimer = setTimeout(async () => {
        if ($entity.groupname === '') {
          groupnameVerified = undefined;
          groupnameVerifiedMessage = undefined;
          return;
        }
        try {
          const data = await $entity.$checkGroupname();
          groupnameVerified = data.result;
          groupnameVerifiedMessage = data.message;
        } catch (e: any) {
          groupnameVerified = false;
          groupnameVerifiedMessage = e?.message;
        }
      }, 400);
      oldGroupname = $entity.groupname;
    }
  });

  let oldEmail: string | undefined = undefined;
  $effect(() => {
    if ($entity && $entity.email !== oldEmail) {
      if (emailTimer) {
        clearTimeout(emailTimer);
      }
      emailTimer = setTimeout(async () => {
        if ($entity.email === '') {
          emailVerified = undefined;
          emailVerifiedMessage = undefined;
          return;
        }
        try {
          const data = await $entity.$checkEmail();
          emailVerified = data.result;
          emailVerifiedMessage = data.message;
        } catch (e: any) {
          emailVerified = false;
          emailVerifiedMessage = e?.message;
        }
      }, 400);
      oldEmail = $entity.email;
    }
  });

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
    $entity.abilities?.push(ability);
    $entity = $entity;
    ability = '';
  }
  function abilityKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') addAbility();
  }

  async function saveEntity() {
    saving = true;
    failureMessage = undefined;
    const newEntity = $entity.guid == null;
    try {
      if (await $entity.$save()) {
        await readyEntity();
        success = true;
        if (newEntity) {
          router.navigate(
            `/groups/edit/${encodeURIComponent($entity.guid || '')}`,
            { historyAPIMethod: 'replaceState' },
          );
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
        if (await $entity.$delete()) {
          router.navigate('', { historyAPIMethod: 'back' });
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
