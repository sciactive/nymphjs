<div style="display: flex; align-items: center; padding: 12px;">
  <IconButton title="Back" on:click={() => dispatch('leave')}>
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
{#if entity != null}
  {#if clientConfig == null || user == null}
    <section style="padding-top: 0;">
      <div style="display: flex; justify-content: center; align-items: center;">
        <CircularProgress style="height: 45px; width: 45px;" indeterminate />
      </div>
    </section>
  {:else}
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
            <a href="https://en.gravatar.com/" target="_blank">
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
            <span
              >{entity.group.name + ' (' + entity.group.groupname + ')'}</span
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
            <CircularProgress
              style="height: 32px; width: 32px;"
              indeterminate
            />
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
            {#each entity.groups as curEntity, index (curEntity.guid)}
              <Row>
                {#if !clientConfig.emailUsernames}
                  <Cell>{curEntity.groupname}</Cell>
                {/if}
                <Cell>{curEntity.name}</Cell>
                <Cell>{curEntity.email}</Cell>
                <Cell>{curEntity.enabled ? 'Yes' : 'No'}</Cell>
                <Cell>
                  <IconButton
                    on:click={() => {
                      entity.groups.splice(index, 1);
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
            <CircularProgress
              style="height: 32px; width: 32px;"
              indeterminate
            />
          </div>
        {:else if secondaryGroups != null}
          <DataTable
            table$aria-label="Secondary group list"
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
              </Row>
            </Head>
            <Body>
              {#each secondaryGroups as curEntity, index (curEntity.guid)}
                <Row
                  on:click={() => {
                    entity.groups.push(curEntity);
                    secondaryGroups.splice(index, 1);
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
          {#each entity.abilities as ability, index (ability)}
            <Item>
              <Text>
                {ability}
              </Text>
              <Meta>
                <IconButton
                  on:click={() => {
                    entity.abilities.splice(index, 1);
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
          <Button
            on:click={addTilmeldAdminAbility}
            title="Tilmeld Admins have the ability to modify, create, and delete users and groups, and grant and revoke abilities."
          >
            <Label>Tilmeld Admin</Label>
          </Button>
          {#if sysAdmin}
            <Button
              on:click={addSystemAdminAbility}
              title="System Admins have all abilities. Gatekeeper checks always return true."
            >
              <Label>System Admin</Label>
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
            An email change uses all of the following properties. The email
            change date is used to rate limit email changes and to allow the
            user to cancel the change within the rate limit time. The new secret
            is emailed to the new address, and when the user clicks the link,
            that email address is set for their account. The cancel secret is
            emailed to the old address and will reset the user's email to the
            cancel address if the link is clicked in time.
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

      <div style="margin-top: 36px;">
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
    </section>
  {/if}
{/if}

<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import {
    AdminGroupData,
    AdminUserData,
    ClientConfig,
    CurrentUserData,
    Group,
    User,
  } from '@nymphjs/tilmeld-client';
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
  import HelperText from '@smui/textfield/helper-text/index';
  import IconButton from '@smui/icon-button';
  import Button from '@smui/button';
  import Fab from '@smui/fab';
  import { Icon, Label } from '@smui/common';
  import Svg from '@smui/common/Svg.svelte';

  const dispatch = createEventDispatcher();

  export let entity: User & AdminUserData;

  let clientConfig: ClientConfig | null = null;
  let user: (User & CurrentUserData) | null = null;
  let sysAdmin = false;
  let activeTab: 'General' | 'Groups' | 'Abilities' | 'Security' = 'General';
  let primaryGroupSearch = '';
  let secondaryGroupSearch = '';
  let ability = '';
  let avatar = 'https://secure.gravatar.com/avatar/?d=mm&s=40';
  let failureMessage: string | null = null;
  let passwordVerify = '';
  let passwordVerified: boolean | null = null;
  let usernameTimer: NodeJS.Timeout | null = null;
  let usernameVerified: boolean | null = null;
  let usernameVerifiedMessage: string | null = null;
  let emailTimer: NodeJS.Timeout | null = null;
  let emailVerified: boolean | null = null;
  let emailVerifiedMessage: string | null = null;
  let saving = false;
  let success: boolean | null = null;

  onMount(async () => {
    user = await User.current();
    sysAdmin = await user.$gatekeeper('system/admin');
  });
  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  readyEntity();
  function readyEntity() {
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
    entity.$getAvatar().then((value) => {
      avatar = value;
    });
    entity.$readyAll(1).then(() => {
      entity = entity;
    });
  }

  let primaryGroupsSearching = false;
  let primaryGroups: (Group & AdminGroupData)[] | null = null;
  async function searchPrimaryGroups() {
    primaryGroupsSearching = true;
    failureMessage = null;
    if (primaryGroupSearch.trim() == '') {
      return;
    }
    let query = primaryGroupSearch;
    if (!query.match(/[_%]/)) {
      query += '%';
    }
    try {
      primaryGroups = (await Group.getPrimaryGroups(query)).filter((group) => {
        return !group.$is(entity.group);
      });
    } catch (e: any) {
      failureMessage = e?.message;
    }
    primaryGroupsSearching = false;
  }
  function primaryGroupSearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') searchPrimaryGroups();
  }

  let secondaryGroupsSearching = false;
  let secondaryGroups: (Group & AdminGroupData)[] | null = null;
  async function searchSecondaryGroups() {
    secondaryGroupsSearching = true;
    failureMessage = null;
    if (secondaryGroupSearch.trim() == '') {
      return;
    }
    let query = secondaryGroupSearch;
    if (!query.match(/[_%]/)) {
      query += '%';
    }
    try {
      secondaryGroups = (await Group.getSecondaryGroups(query)).filter(
        (group) => {
          return !group.$inArray(entity.groups);
        }
      );
    } catch (e: any) {
      failureMessage = e?.message;
    }
    secondaryGroupsSearching = false;
  }
  function secondaryGroupSearchKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') searchSecondaryGroups();
  }

  let oldUsername = entity.username;
  $: if (entity.username !== oldUsername) {
    if (usernameTimer) {
      clearTimeout(usernameTimer);
    }
    usernameTimer = setTimeout(async () => {
      if (entity.username === '') {
        usernameVerified = null;
        usernameVerifiedMessage = null;
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

  let oldEmail = entity.email;
  $: if (entity.email !== oldEmail) {
    if (emailTimer) {
      clearTimeout(emailTimer);
    }
    emailTimer = setTimeout(async () => {
      if (entity.email === '') {
        emailVerified = null;
        emailVerifiedMessage = null;
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
      passwordVerified = null;
    }
    passwordVerified = entity.passwordTemp === passwordVerify;
  }

  function addAbility() {
    if (ability === '') {
      return;
    }
    entity.abilities.push(ability);
    ability = '';
    entity = entity;
  }
  function abilityKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') addAbility();
  }

  function addTilmeldAdminAbility() {
    if (entity.abilities.indexOf('tilmeld/admin') === -1) {
      entity.abilities.push('tilmeld/admin');
      entity = entity;
    }
  }

  function addSystemAdminAbility() {
    if (entity.abilities.indexOf('system/admin') === -1) {
      entity.abilities.push('system/admin');
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
    failureMessage = null;
    try {
      if (await entity.$save()) {
        success = true;
        setTimeout(() => {
          success = null;
        }, 1000);
        readyEntity();
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
    failureMessage = null;
    if (confirm('Are you sure you want to delete this?')) {
      saving = true;
      try {
        if (await entity.$delete()) {
          dispatch('leave');
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
