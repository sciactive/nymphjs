{#if $clientConfig == null || $user == null || loading}
  <section>
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress style="height: 45px; width: 45px;" indeterminate />
    </div>
  </section>
{:else}
  <div style="display: flex; align-items: center; padding: 12px;">
    <IconButton title="Back" onclick={() => pop()}>
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
          href="/users/edit/{encodeURIComponent($entity.user.guid || '')}"
          use:link
          >{$clientConfig.userFields.includes('name')
            ? $entity.user.name + ' (' + $entity.user.username + ')'
            : $entity.user.username}</a
        >
      </div>
    {/await}
  {/if}

  <TabBar
    tabs={['General', 'Parent', 'Children', 'Abilities', 'Users']}
    bind:active={activeTab}
  >
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
            href="/groups/edit/{encodeURIComponent($entity.parent.guid || '')}"
            use:link
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

    {#if activeTab === 'Children'}
      <h5 style="margin-top: 0;">Children</h5>

      <DataTable
        sortable
        bind:sort={childrenSort}
        bind:sortDirection={childrenSortDirection}
        onSMUIDataTableSorted={handleChildrenSort}
        table$aria-label="Children list"
        style="width: 100%;"
      >
        <Head>
          <Row>
            {#if !$clientConfig.emailUsernames}
              <Cell columnId="child-groupname">
                <Label>Groupname</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            {#if $clientConfig.userFields.includes('name')}
              <Cell columnId="child-name">
                <Label>Name</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            {#if $clientConfig.userFields.includes('email')}
              <Cell columnId="child-email">
                <Label>Email</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            <Cell columnId="child-enabled">
              <Label>Enabled</Label>
              <IconButton>
                <Icon class="material-icons">arrow_upward</Icon>
              </IconButton>
            </Cell>
          </Row>
        </Head>
        <Body>
          {#each $children as group (group.guid)}
            <Row>
              {#if !$clientConfig.emailUsernames}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(group.guid || '')}"
                    use:link>{group.groupname}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('name')}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(group.guid || '')}"
                    use:link>{group.name}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('email')}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(group.guid || '')}"
                    use:link>{group.email}</a
                  ></Cell
                >
              {/if}
              <Cell>{group.enabled ? 'Yes' : 'No'}</Cell>
            </Row>
          {:else}
            {null}
          {/each}
        </Body>

        {#snippet progress()}
          <LinearProgress
            indeterminate
            closed={childrenLoaded}
            aria-label="Data is being loaded..."
          />
        {/snippet}

        {#snippet paginate()}
          <Pagination>
            {#snippet rowsPerPage()}
              <Label>Rows Per Page</Label>
              <Select variant="outlined" bind:value={childrenPerPage} noLabel>
                <Option value={10}>10</Option>
                <Option value={25}>25</Option>
                <Option value={100}>100</Option>
              </Select>
            {/snippet}
            {#snippet total()}
              {childrenStart + 1}-{childrenEnd} of {childrenLength}
            {/snippet}

            <IconButton
              action="first-page"
              title="First page"
              onclick={() => (childrenCurrentPage = 0)}
              disabled={childrenCurrentPage === 0}
            >
              <Icon class="material-icons">first_page</Icon>
            </IconButton>
            <IconButton
              action="prev-page"
              title="Prev page"
              onclick={() => childrenCurrentPage--}
              disabled={childrenCurrentPage === 0}
            >
              <Icon class="material-icons">chevron_left</Icon>
            </IconButton>
            <IconButton
              action="next-page"
              title="Next page"
              onclick={() => childrenCurrentPage++}
              disabled={childrenCurrentPage === childrenLastPage}
            >
              <Icon class="material-icons">chevron_right</Icon>
            </IconButton>
            <IconButton
              action="last-page"
              title="Last page"
              onclick={() => (childrenCurrentPage = childrenLastPage)}
              disabled={childrenCurrentPage === childrenLastPage}
            >
              <Icon class="material-icons">last_page</Icon>
            </IconButton>
          </Pagination>
        {/snippet}
      </DataTable>
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

    {#if activeTab === 'Users'}
      <h5 style="margin-top: 0;">Users</h5>

      <DataTable
        sortable
        bind:sort={usersSort}
        bind:sortDirection={usersSortDirection}
        onSMUIDataTableSorted={handleUsersSort}
        table$aria-label="User list"
        style="width: 100%;"
      >
        <Head>
          <Row>
            {#if !$clientConfig.emailUsernames}
              <Cell columnId="user-username">
                <Label>Username</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            {#if $clientConfig.userFields.includes('name')}
              <Cell columnId="user-name">
                <Label>Name</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            {#if $clientConfig.userFields.includes('email')}
              <Cell columnId="user-email">
                <Label>Email</Label>
                <IconButton>
                  <Icon class="material-icons">arrow_upward</Icon>
                </IconButton>
              </Cell>
            {/if}
            <Cell columnId="user-enabled">
              <Label>Enabled</Label>
              <IconButton>
                <Icon class="material-icons">arrow_upward</Icon>
              </IconButton>
            </Cell>
            <Cell columnId="user-primary" sortable={false}>
              <Label>Primary</Label>
            </Cell>
          </Row>
        </Head>
        <Body>
          {#each $users as user (user.guid)}
            <Row>
              {#if !$clientConfig.emailUsernames}
                <Cell
                  ><a
                    href="/users/edit/{encodeURIComponent(user.guid || '')}"
                    use:link>{user.username}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('name')}
                <Cell
                  ><a
                    href="/users/edit/{encodeURIComponent(user.guid || '')}"
                    use:link>{user.name}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('email')}
                <Cell
                  ><a
                    href="/users/edit/{encodeURIComponent(user.guid || '')}"
                    use:link>{user.email}</a
                  ></Cell
                >
              {/if}
              <Cell>{user.enabled ? 'Yes' : 'No'}</Cell>
              <Cell>{$entity.$is(user.group) ? 'Yes' : 'No'}</Cell>
            </Row>
          {:else}
            {null}
          {/each}
        </Body>

        {#snippet progress()}
          <LinearProgress
            indeterminate
            closed={usersLoaded}
            aria-label="Data is being loaded..."
          />
        {/snippet}

        {#snippet paginate()}
          <Pagination>
            {#snippet rowsPerPage()}
              <Label>Rows Per Page</Label>
              <Select variant="outlined" bind:value={usersPerPage} noLabel>
                <Option value={10}>10</Option>
                <Option value={25}>25</Option>
                <Option value={100}>100</Option>
              </Select>
            {/snippet}
            {#snippet total()}
              {usersStart + 1}-{usersEnd} of {usersLength}
            {/snippet}

            <IconButton
              action="first-page"
              title="First page"
              onclick={() => (usersCurrentPage = 0)}
              disabled={usersCurrentPage === 0}
            >
              <Icon class="material-icons">first_page</Icon>
            </IconButton>
            <IconButton
              action="prev-page"
              title="Prev page"
              onclick={() => usersCurrentPage--}
              disabled={usersCurrentPage === 0}
            >
              <Icon class="material-icons">chevron_left</Icon>
            </IconButton>
            <IconButton
              action="next-page"
              title="Next page"
              onclick={() => usersCurrentPage++}
              disabled={usersCurrentPage === usersLastPage}
            >
              <Icon class="material-icons">chevron_right</Icon>
            </IconButton>
            <IconButton
              action="last-page"
              title="Last page"
              onclick={() => (usersCurrentPage = usersLastPage)}
              disabled={usersCurrentPage === usersLastPage}
            >
              <Icon class="material-icons">last_page</Icon>
            </IconButton>
          </Pagination>
        {/snippet}
      </DataTable>
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
  import { getContext } from 'svelte';
  import { link, pop, replace } from 'svelte-spa-router';
  import type {
    AdminGroupData,
    ClientConfig,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import type {
    Group as GroupClass,
    User as UserClass,
    AdminUserData,
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
  import DataTable, {
    Head,
    Body,
    Row,
    Cell,
    Pagination,
    SortValue,
  } from '@smui/data-table';
  import Select, { Option } from '@smui/select';
  import Textfield, { Input } from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import IconButton from '@smui/icon-button';
  import Button from '@smui/button';
  import LinearProgress from '@smui/linear-progress';
  import { Icon, Label } from '@smui/common';

  import { nymph, Group, User } from '../nymph.js';

  let { params }: { params: { guid: string } } = $props();

  let entity: Writable<GroupClass & AdminGroupData> = writable(
    Group.factorySync(),
  );
  let activeTab: 'General' | 'Parent' | 'Children' | 'Abilities' | 'Users' =
    $state('General');
  let parentSearch = $state('');
  let ability = $state('');
  let avatar = $state('https://secure.gravatar.com/avatar/?d=mm&s=40');
  let failureMessage: string | undefined = $state();
  let groupnameTimer: number | undefined = undefined;
  let groupnameVerified: boolean | undefined = $state();
  let groupnameVerifiedMessage: string | undefined = $state();
  let emailTimer: number | undefined = undefined;
  let emailVerified: boolean | undefined = $state();
  let emailVerifiedMessage: string | undefined = $state();
  let children: Writable<(GroupClass & AdminGroupData)[]> = $state(
    writable([]),
  );
  let childrenSort: `child-${keyof AdminGroupData}` = $state('child-groupname');
  let childrenSortDirection: Lowercase<SortValue> = $state('ascending');
  let childrenPerPage = $state(10);
  let childrenCurrentPage = $state(0);
  let childrenLength = $state(0);
  const childrenStart = $derived(childrenCurrentPage * childrenPerPage);
  const childrenEnd = $derived(
    Math.min(childrenStart + childrenPerPage, childrenLength),
  );
  const childrenLastPage = $derived(
    Math.max(Math.ceil(childrenLength / childrenPerPage) - 1, 0),
  );
  let childrenLoaded = $state(false);
  let users: Writable<(UserClass & AdminUserData)[]> = $state(writable([]));
  let usersSort: `user-${keyof AdminUserData}` = $state('user-username');
  let usersSortDirection: Lowercase<SortValue> = $state('ascending');
  let usersPerPage = $state(10);
  let usersCurrentPage = $state(0);
  let usersLength = $state(0);
  const usersStart = $derived(usersCurrentPage * usersPerPage);
  const usersEnd = $derived(Math.min(usersStart + usersPerPage, usersLength));
  const usersLastPage = $derived(
    Math.max(Math.ceil(usersLength / usersPerPage) - 1, 0),
  );
  let usersLoaded = $state(false);
  let saving = $state(false);
  let success: boolean | undefined = $state();
  let loading = $state(true);

  const clientConfig =
    getContext<Writable<ClientConfig | undefined>>('clientConfigStore');
  const user =
    getContext<Writable<(UserClass & CurrentUserData) | null | undefined>>(
      'userStore',
    );

  $effect(() => {
    if (params) {
      handleGuidParam();
    }
  });

  $effect(() => {
    if (usersCurrentPage >= 0 && usersPerPage >= 0) {
      fillUsers();
    }
  });

  $effect(() => {
    if (childrenCurrentPage >= 0 && childrenPerPage >= 0) {
      fillChildren();
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

    await fillUsers();
    await fillChildren();
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

  async function handleChildrenSort() {
    await fillChildren();
  }

  async function fillChildren() {
    childrenLoaded = false;
    try {
      if ($entity.guid == null) {
        $children = [];
        childrenLength = 0;
      } else {
        $children = await nymph.getEntities(
          {
            class: Group,
            sort: childrenSort.slice('child-'.length),
            reverse: childrenSortDirection === 'descending',
            limit: childrenPerPage,
            offset: childrenPerPage * childrenCurrentPage,
          },
          {
            type: '&',
            ref: ['parent', $entity],
          },
        );

        if (childrenLength === 0) {
          childrenLength = await nymph.getEntities(
            {
              class: Group,
              return: 'count',
            },
            {
              type: '&',
              ref: ['parent', $entity],
            },
          );
        }
      }
    } catch (e: any) {
      failureMessage = e.message;
    }
    childrenLoaded = true;
  }

  async function handleUsersSort() {
    await fillUsers();
  }

  async function fillUsers() {
    usersLoaded = false;
    try {
      if ($entity.guid == null) {
        $users = [];
        usersLength = 0;
      } else {
        $users = await nymph.getEntities(
          {
            class: User,
            sort: usersSort.slice('user-'.length),
            reverse: usersSortDirection === 'descending',
            limit: usersPerPage,
            offset: usersPerPage * usersCurrentPage,
          },
          {
            type: '|',
            ref: [
              ['group', $entity],
              ['groups', $entity],
            ],
          },
        );

        if (usersLength === 0) {
          usersLength = await nymph.getEntities(
            {
              class: User,
              return: 'count',
            },
            {
              type: '|',
              ref: [
                ['group', $entity],
                ['groups', $entity],
              ],
            },
          );
        }
      }
    } catch (e: any) {
      failureMessage = e.message;
    }
    usersLoaded = true;
  }

  async function saveEntity() {
    saving = true;
    failureMessage = undefined;
    const newEntity = $entity.guid == null;
    try {
      await $entity.$save();
      await readyEntity();
      success = true;
      if (newEntity) {
        replace(`/groups/edit/${encodeURIComponent($entity.guid || '')}`);
      }
      setTimeout(() => {
        success = undefined;
      }, 1000);
    } catch (e: any) {
      console.log('error:', e);
      failureMessage = e?.message;
    }
    saving = false;
  }

  async function deleteEntity() {
    failureMessage = undefined;
    if (
      confirm(
        'Are you sure you want to delete this? All descendant groups will be deleted too, and users will be removed.',
      )
    ) {
      saving = true;
      try {
        await $entity.$delete();
        pop();
      } catch (e: any) {
        failureMessage = e?.message;
      }
      saving = false;
    }
  }
</script>
