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
      Editing {entity.guid
        ? entity.$is(user)
          ? 'Yourself'
          : entity.name
        : 'New User'}
    </h2>
  </div>

  <TabBar
    tabs={['General', 'Groups', 'Abilities', 'Security']}
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
        <LayoutCell span={4}>
          <div class="mdc-typography--headline6">GUID</div>
          <code>{entity.guid}</code>
        </LayoutCell>
        <LayoutCell span={4}>
          <FormField>
            <Checkbox bind:checked={entity.enabled} />
            <span slot="label">Enabled (Able to log in)</span>
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
              bind:value={entity.username}
              label="Username"
              type="text"
              style="width: 100%;"
              helperLine$style="width: 100%;"
              invalid={usernameVerified === false}
              input$autocomplete="off"
              input$autocapitalize="off"
              input$spellcheck="false"
            >
              <HelperText persistent slot="helper">
                {usernameVerifiedMessage ?? ''}
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
          >
            <HelperText persistent slot="helper">
              {emailVerifiedMessage ?? ''}
            </HelperText>
          </Textfield>
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={entity.nameFirst}
            label="First Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={entity.nameMiddle}
            label="Middle Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={entity.nameLast}
            label="Last Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={8}>
          <Textfield
            bind:value={entity.avatar}
            label="Avatar"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={entity.phone}
            label="Phone"
            type="tel"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.passwordTemp}
            label={`${entity.guid ? 'Update ' : ''}Password`}
            type="password"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={passwordVerify}
            label="Repeat Password"
            type="password"
            style="width: 100%;"
            invalid={passwordVerified === false}
            input$autocomplete="off"
            on:blur={doVerifyPassword}
          />
        </LayoutCell>
      </LayoutGrid>
    {/if}

    {#if activeTab === 'Groups'}
      <h5 style="margin-top: 0;">Primary Group</h5>

      <Paper
        style="display: flex; justify-content: space-between; align-items: center;"
      >
        {#if !entity.group}
          No primary group
        {:else}
          <a href="#/groups/edit/{encodeURIComponent(entity.group.guid || '')}"
            >{entity.group.name + ' (' + entity.group.groupname + ')'}</a
          >

          <IconButton
            on:click={() => {
              delete entity.group;
              entity = entity;
            }}
          >
            <Icon component={Svg} viewBox="0 0 24 24">
              <path fill="currentColor" d={mdiMinus} />
            </Icon>
          </IconButton>
        {/if}
      </Paper>

      <h6>Change Primary Group</h6>

      <div class="solo-search-container solo-container">
        <Paper class="solo-paper" elevation={1}>
          <Icon class="solo-icon" component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiMagnify} />
          </Icon>
          <Input
            bind:value={primaryGroupSearch}
            on:keydown={primaryGroupSearchKeyDown}
            placeholder="Primary Group Search"
            class="solo-input"
          />
        </Paper>
        <IconButton
          on:click={searchPrimaryGroups}
          disabled={primaryGroupSearch === ''}
          class="solo-fab"
          title="Search"
        >
          <Icon component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiArrowRight} />
          </Icon>
        </IconButton>
      </div>

      {#if primaryGroupsSearching}
        <div
          style="display: flex; justify-content: center; align-items: center;"
        >
          <CircularProgress style="height: 32px; width: 32px;" indeterminate />
        </div>
      {:else if primaryGroups != null}
        <DataTable table$aria-label="Primary group list" style="width: 100%;">
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
            {#each primaryGroups as curEntity (curEntity.guid)}
              <Row
                on:click={() => (entity.group = curEntity)}
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

      <h5>Secondary Groups</h5>

      <DataTable
        table$aria-label="Current secondary groups"
        style="width: 100%;"
      >
        <Head>
          <Row>
            {#if !clientConfig.emailUsernames}
              <Cell>Groupname</Cell>
            {/if}
            <Cell>Name</Cell>
            <Cell>Email</Cell>
            <Cell>Enabled</Cell>
            <Cell>Remove</Cell>
          </Row>
        </Head>
        <Body>
          {#if entity.groups}
            {#each entity.groups as curEntity, index (curEntity.guid)}
              <Row>
                {#if !clientConfig.emailUsernames}
                  <Cell
                    ><a
                      href="#/groups/edit/{encodeURIComponent(
                        curEntity.guid || ''
                      )}">{curEntity.groupname}</a
                    ></Cell
                  >
                {/if}
                <Cell
                  ><a
                    href="#/groups/edit/{encodeURIComponent(
                      curEntity.guid || ''
                    )}">{curEntity.name}</a
                  ></Cell
                >
                <Cell
                  ><a
                    href="#/groups/edit/{encodeURIComponent(
                      curEntity.guid || ''
                    )}">{curEntity.email}</a
                  ></Cell
                >
                <Cell>{curEntity.enabled ? 'Yes' : 'No'}</Cell>
                <Cell>
                  <IconButton
                    on:click={() => {
                      entity.groups?.splice(index, 1);
                      entity = entity;
                    }}
                  >
                    <Icon component={Svg} viewBox="0 0 24 24">
                      <path fill="currentColor" d={mdiMinus} />
                    </Icon>
                  </IconButton>
                </Cell>
              </Row>
            {:else}
              <Row>
                <Cell colspan={clientConfig.emailUsernames ? 4 : 5}>
                  No secondary groups
                </Cell>
              </Row>
            {/each}
          {/if}
        </Body>
      </DataTable>

      <h6>Add Secondary Groups</h6>

      <div class="solo-search-container solo-container">
        <Paper class="solo-paper" elevation={1}>
          <Icon class="solo-icon" component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiMagnify} />
          </Icon>
          <Input
            bind:value={secondaryGroupSearch}
            on:keydown={secondaryGroupSearchKeyDown}
            placeholder="Secondary Group Search"
            class="solo-input"
          />
        </Paper>
        <IconButton
          on:click={searchSecondaryGroups}
          disabled={secondaryGroupSearch === ''}
          class="solo-fab"
          title="Search"
        >
          <Icon component={Svg} viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiArrowRight} />
          </Icon>
        </IconButton>
      </div>

      {#if secondaryGroupsSearching}
        <div
          style="display: flex; justify-content: center; align-items: center;"
        >
          <CircularProgress style="height: 32px; width: 32px;" indeterminate />
        </div>
      {:else if secondaryGroups != null}
        <DataTable table$aria-label="Secondary group list" style="width: 100%;">
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
            {#each secondaryGroups as curEntity, index (curEntity.guid)}
              <Row
                on:click={() => {
                  entity.groups?.push(curEntity);
                  secondaryGroups?.splice(index, 1);
                  entity = entity;
                }}
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
        {#if sysAdmin}
          <Button
            on:click={addSystemAdminAbility}
            title="System Admins have all abilities. Gatekeeper checks always return true."
          >
            <Label>System Admin</Label>
          </Button>
          <Button
            on:click={addTilmeldAdminAbility}
            title="Tilmeld Admins have the ability to modify, create, and delete users and groups, and grant and revoke abilities."
          >
            <Label>Tilmeld Admin</Label>
          </Button>
          <Button
            on:click={addTilmeldSwitchAbility}
            title="The switch user ability lets a user log in as another non-admin user without needing their password."
          >
            <Label>Switch User</Label>
          </Button>
        {/if}
      </div>

      <h6>Inherit Abilities</h6>

      <div>
        <FormField>
          <Checkbox bind:checked={entity.inheritAbilities} />
          <span slot="label"
            >Additionally, inherit the abilities of the group(s) this user
            belongs to.</span
          >
        </FormField>
      </div>
    {/if}

    {#if activeTab === 'Security'}
      <LayoutGrid style="padding: 0;">
        <LayoutCell span={12}>
          The email verification secret is the code emailed to the user to
          verify their address when they first sign up.
        </LayoutCell>
        <LayoutCell span={12}>
          <Textfield
            bind:value={entity.secret}
            label="Email Verification Secret"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={12}>
          The account recovery secret is the code emailed to the user to allow
          them to change their password and recover their account. The date is
          used to determine if the code has expired.
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.recoverSecret}
            label="Account Recovery Secret"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.recoverSecretDate}
            label="Account Recovery Date (Timestamp)"
            type="number"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={12}>
          An email change uses all of the following properties. The email change
          date is used to rate limit email changes and to allow the user to
          cancel the change within the rate limit time. The new secret is
          emailed to the new address, and when the user clicks the link, that
          email address is set for their account. The cancel secret is emailed
          to the old address and will reset the user's email to the cancel
          address if the link is clicked in time.
        </LayoutCell>
        <LayoutCell span={12}>
          <Textfield
            bind:value={entity.emailChangeDate}
            label="Email Change Date (Timestamp)"
            type="number"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.newEmailSecret}
            label="New Email Verification Secret"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.newEmailAddress}
            label="New Email Address"
            type="email"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.cancelEmailSecret}
            label="Cancel Email Verification Secret"
            type="text"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={entity.cancelEmailAddress}
            label="Cancel Email Address"
            type="email"
            style="width: 100%;"
            input$autocomplete="off"
          />
        </LayoutCell>
      </LayoutGrid>
    {/if}

    {#if failureMessage}
      <div class="tilmeld-failure">
        {failureMessage}
      </div>
    {/if}

    <div
      style="margin-top: 36px; display: flex; justify-content: space-between;"
    >
      <div>
        <Button variant="raised" on:click={saveEntity} disabled={saving}>
          <Label>Save User</Label>
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
      {#if tilmeldSwitchUser && !entity.$is(user)}
        <div>
          <Button
            on:click={() => {
              tilmeldSwitchUserDialogOpen = true;
            }}
            disabled={saving}
          >
            <Label>Login as User</Label>
          </Button>
        </div>
      {/if}
    </div>
  </section>
{/if}

<Dialog
  bind:open={tilmeldSwitchUserDialogOpen}
  aria-labelledby="switch-user-title"
  aria-describedby="switch-user-content"
  on:SMUIDialog:closed={switchUserDialogCloseHandler}
>
  <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
  <Title id="switch-user-title">Switch User</Title>
  <Content id="switch-user-content">
    <p>
      Switching users will let you use the app as this user, even if the user
      account is disabled. You will remain logged in as this user until you log
      out, at which time, you will go back to being logged in as yourself.
    </p>
    <p>Once you switch, you will be forwarded to the main app.</p>
  </Content>
  <Actions>
    <Button action="cancel">
      <Label>Cancel</Label>
    </Button>
    <Button action="switch" default>
      <Label>Switch</Label>
    </Button>
  </Actions>
</Dialog>

<script lang="ts">
  import { onMount } from 'svelte';
  import { pop, replace } from 'svelte-spa-router';
  import type {
    AdminGroupData,
    AdminUserData,
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
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import { Icon, Label, Svg } from '@smui/common';

  import { User, Group } from '../nymph';

  export let params: { guid: string };

  let entity: UserClass & AdminUserData;
  let clientConfig: ClientConfig | undefined = undefined;
  let user: (UserClass & CurrentUserData) | undefined = undefined;
  let sysAdmin = false;
  let tilmeldSwitchUser = false;
  let tilmeldSwitchUserDialogOpen = false;
  let activeTab: 'General' | 'Groups' | 'Abilities' | 'Security' = 'General';
  let primaryGroupSearch = '';
  let secondaryGroupSearch = '';
  let ability = '';
  let avatar = 'https://secure.gravatar.com/avatar/?d=mm&s=40';
  let failureMessage: string | undefined = undefined;
  let passwordVerify = '';
  let passwordVerified: boolean | undefined = undefined;
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = undefined;
  let usernameVerifiedMessage: string | undefined = undefined;
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
    sysAdmin = (await user?.$gatekeeper('system/admin')) ?? false;
    tilmeldSwitchUser = (await user?.$gatekeeper('tilmeld/switch')) ?? false;
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
          ? await User.factory()
          : await User.factory(params.guid);
      oldUsername = entity.username;
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
    if (entity.username == null) {
      entity.username = '';
    }
    if (entity.email == null) {
      entity.email = '';
    }
    if (entity.nameFirst == null) {
      entity.nameFirst = '';
    }
    if (entity.nameMiddle == null) {
      entity.nameMiddle = '';
    }
    if (entity.nameLast == null) {
      entity.nameLast = '';
    }
    if (entity.avatar == null) {
      entity.avatar = '';
    }
    if (entity.phone == null) {
      entity.phone = '';
    }
    if (entity.passwordTemp == null) {
      entity.passwordTemp = '';
    }
    if (entity.inheritAbilities == null) {
      entity.inheritAbilities = false;
    }
    if (entity.secret == null) {
      entity.secret = '';
    }
    if (entity.emailChangeDate == null) {
      entity.emailChangeDate = 0;
    }
    if (entity.newEmailSecret == null) {
      entity.newEmailSecret = '';
    }
    if (entity.newEmailAddress == null) {
      entity.newEmailAddress = '';
    }
    if (entity.cancelEmailSecret == null) {
      entity.cancelEmailSecret = '';
    }
    if (entity.cancelEmailAddress == null) {
      entity.cancelEmailAddress = '';
    }
    if (entity.recoverSecret == null) {
      entity.recoverSecret = '';
    }
    if (entity.recoverSecretDate == null) {
      entity.recoverSecretDate = 0;
    }
    avatar = await entity.$getAvatar();
    await entity.$readyAll(1);
  }

  let primaryGroupsSearching = false;
  let primaryGroups: (GroupClass & AdminGroupData)[] | undefined = undefined;
  async function searchPrimaryGroups() {
    primaryGroupsSearching = true;
    failureMessage = undefined;
    if (primaryGroupSearch.trim() == '') {
      return;
    }
    try {
      const [options, ...selectors] = queryParser({
        query: primaryGroupSearch,
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
      primaryGroups = (await Group.getPrimaryGroups(options, selectors)).filter(
        (group) => {
          return !group.$is(entity.group);
        }
      );
    } catch (e: any) {
      failureMessage = e?.message;
    }
    primaryGroupsSearching = false;
  }
  function primaryGroupSearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchPrimaryGroups();
  }

  let secondaryGroupsSearching = false;
  let secondaryGroups: (GroupClass & AdminGroupData)[] | undefined = undefined;
  async function searchSecondaryGroups() {
    secondaryGroupsSearching = true;
    failureMessage = undefined;
    if (secondaryGroupSearch.trim() == '') {
      return;
    }
    try {
      const [options, ...selectors] = queryParser({
        query: secondaryGroupSearch,
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
      secondaryGroups = (
        await Group.getSecondaryGroups(options, selectors)
      ).filter((group) => {
        return !group.$inArray(entity.groups ?? []);
      });
    } catch (e: any) {
      failureMessage = e?.message;
    }
    secondaryGroupsSearching = false;
  }
  function secondaryGroupSearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchSecondaryGroups();
  }

  let oldUsername: string | undefined = undefined;
  $: if (entity && entity.username !== oldUsername) {
    if (usernameTimer) {
      clearTimeout(usernameTimer);
    }
    usernameTimer = setTimeout(async () => {
      if (entity.username === '') {
        usernameVerified = undefined;
        usernameVerifiedMessage = undefined;
        return;
      }
      try {
        const data = await entity.$checkUsername();
        usernameVerified = data.result;
        usernameVerifiedMessage = data.message;
      } catch (e: any) {
        usernameVerified = false;
        usernameVerifiedMessage = e?.message;
      }
    }, 400);
    oldUsername = entity.username;
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

  function doVerifyPassword() {
    if (
      (entity.passwordTemp == null || entity.passwordTemp === '') &&
      passwordVerify === ''
    ) {
      passwordVerified = undefined;
    }
    passwordVerified = entity.passwordTemp === passwordVerify;
  }

  function addAbility() {
    if (ability === '') {
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

  function addSystemAdminAbility() {
    if (entity.abilities?.indexOf('system/admin') === -1) {
      entity.abilities?.push('system/admin');
      entity = entity;
    }
  }

  function addTilmeldAdminAbility() {
    if (entity.abilities?.indexOf('tilmeld/admin') === -1) {
      entity.abilities?.push('tilmeld/admin');
      entity = entity;
    }
  }

  function addTilmeldSwitchAbility() {
    if (entity.abilities?.indexOf('tilmeld/switch') === -1) {
      entity.abilities?.push('tilmeld/switch');
      entity = entity;
    }
  }

  async function saveEntity() {
    if (
      (entity.passwordTemp != null || entity.passwordTemp !== '') &&
      entity.passwordTemp !== passwordVerify
    ) {
      failureMessage = "Passwords don't match!";
      return;
    }

    saving = true;
    failureMessage = undefined;
    const newEntity = entity.guid == null;
    try {
      if (await entity.$save()) {
        success = true;
        passwordVerify = '';
        if (newEntity) {
          replace(`/users/edit/${encodeURIComponent(entity.guid || '')}`);
        }
        await readyEntity();
        setTimeout(() => {
          success = undefined;
        }, 1000);
      } else {
        failureMessage = 'Error saving user.';
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

  async function switchUserDialogCloseHandler(
    e: CustomEvent<{ action: string }>
  ) {
    if (e.detail.action === 'switch') {
      saving = true;
      try {
        const result = await entity.$switchUser();

        if (result.result) {
          window.location.href =
            (window as unknown as { appUrl: string }).appUrl ||
            window.location.href;
        } else {
          failureMessage = result.message;
        }
      } catch (e: any) {
        failureMessage = e?.message;
      }
      saving = false;
    }
  }
</script>