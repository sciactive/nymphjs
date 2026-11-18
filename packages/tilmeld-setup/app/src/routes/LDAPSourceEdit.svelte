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
      Editing {$entity.guid ? $entity.host : 'New LDAP Source'}
    </h2>
  </div>

  <TabBar tabs={['Connection', 'Groups', 'Users']} bind:active={activeTab}>
    {#snippet tab(tab: string)}
      <Tab {tab}>
        <Label>{tab}</Label>
      </Tab>
    {/snippet}
  </TabBar>

  <section>
    {#if activeTab === 'Connection'}
      <LayoutGrid style="padding: 0;">
        <LayoutCell span={8}>
          <div class="mdc-typography--headline6">GUID</div>
          <code>{$entity.guid}</code>
        </LayoutCell>
        <LayoutCell span={4}>
          <FormField>
            <Checkbox bind:checked={$entity.enabled} />
            {#snippet label()}
              Enabled (Users are synced and enabled.)
            {/snippet}
          </FormField>
        </LayoutCell>

        <LayoutCell span={8}>
          <Textfield
            bind:value={$entity.host}
            label="Remote Host"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
            required
          >
            {#snippet helper()}
              <HelperText>The host of the server.</HelperText>
            {/snippet}
          </Textfield>
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.port}
            input$emptyValueUndefined
            label="Remote Port"
            type="number"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          >
            {#snippet helper()}
              <HelperText
                >The port on the server. Default is 389 for plain/StartTLS, 636
                for LDAPS. 0 to use default.</HelperText
              >
            {/snippet}
          </Textfield>
        </LayoutCell>

        <LayoutCell span={6}>
          <Select
            bind:value={$entity.encryption}
            label="Encryption Type"
            required
          >
            {#each [{ label: 'Plain (No Encryption)', value: 'none' }, { label: 'StartTLS', value: 'starttls' }, { label: 'LDAPS', value: 'ldaps' }] as entry}
              <Option value={entry.value}>{entry.label}</Option>
            {/each}

            {#snippet helperText()}
              The encryption type.
            {/snippet}
          </Select>
        </LayoutCell>
        <LayoutCell span={6}>
          <FormField>
            <Checkbox bind:checked={$entity.ignoreCertificateErrors} />
            {#snippet label()}
              Whether to ignore SSL certificate errors. This is not secure, and
              should not be used in production environments.
            {/snippet}
          </FormField>
        </LayoutCell>

        <LayoutCell span={6}>
          <Textfield
            bind:value={$entity.bindUsername}
            label="Bind Username"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          >
            {#snippet helper()}
              <HelperText
                >The Distinguished Name or User Principal Name of a service
                account. This account will be used to search the directory.
                Leave empty for anonymous bind.</HelperText
              >
            {/snippet}
          </Textfield>
        </LayoutCell>
        <LayoutCell span={6}>
          <Textfield
            bind:value={$entity.bindPassword}
            label="Bind Password"
            type="password"
            style="width: 100%;"
          >
            {#snippet helper()}
              <HelperText>The password for the bind account.</HelperText>
            {/snippet}
          </Textfield>
        </LayoutCell>

        <LayoutCell span={12} style="text-align: end;">
          <Button variant="outlined" onclick={testBind} disabled={saving}>
            <Label>Test Bind</Label>
          </Button>
        </LayoutCell>
      </LayoutGrid>

      <div
        style="display: flex; flex-direction: column; gap: 1em; margin-top: 1em;"
      >
        <div
          style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 1em; align-items: baseline;"
        >
          <div style="flex-grow: 1;">
            <Textfield
              bind:value={$entity.searchBase}
              label="Search Base"
              type="text"
              style="width: 100%;"
              input$autocapitalize="off"
              input$autocomplete="off"
              required
            >
              {#snippet helper()}
                <HelperText
                  >The base Distinguished Name used to search for user entries.</HelperText
                >
              {/snippet}
            </Textfield>
          </div>
          <Button onclick={testList} disabled={testListing}>
            <Label>Test Listing</Label>
          </Button>
        </div>

        <div
          style="display: flex; background: #333; border: 1px solid #ccc; border-radius: 1em; color: #ccc; padding: 1em; height: auto; min-height: 200px; max-height: 600px; overflow: auto;"
        >
          {#if testListing}
            <CircularProgress
              style="height: 45px; width: 45px; align-self: center; margin: 0 auto;"
              indeterminate
            />
          {:else}
            <pre style="padding: 0px; margin: 0; width: 100%;">{JSON.stringify(
                testListResults,
                null,
                2,
              )}</pre>
          {/if}
        </div>
      </div>
    {/if}

    {#if activeTab === 'Groups'}
      <h5 style="margin-top: 0;">Group Mapping</h5>

      <LayoutGrid style="padding: 0;">
        <LayoutCell
          span={8}
          style="display: flex; flex-direction: column; gap: .25em;"
        >
          <div>
            <Textfield
              bind:value={$entity.groupAttributeOnUser}
              input$emptyValueUndefined
              label="Group Attribute on User"
              type="text"
              style="width: 100%;"
              input$autocapitalize="off"
              input$autocomplete="off"
            >
              {#snippet helper()}
                <HelperText
                  >The user attribute listing group memberships. Use <code
                    >memberOf</code
                  >
                  for Active Directory.</HelperText
                >
              {/snippet}
            </Textfield>
          </div>
          <div>
            <Textfield
              bind:value={$entity.groupAttributeOnGroup}
              input$emptyValueUndefined
              label="Group Attribute on Group"
              type="text"
              style="width: 100%;"
              input$autocapitalize="off"
              input$autocomplete="off"
            >
              {#snippet helper()}
                <HelperText
                  >The group attribute listing member users. Use <code
                    >uniqueMember</code
                  > for LDAP. Empty for Active Directory.</HelperText
                >
              {/snippet}
            </Textfield>
          </div>
        </LayoutCell>
        <LayoutCell span={4}>
          <FormField>
            <Checkbox
              bind:checked={$entity.restrictRegistrationToMappedUsers}
            />
            {#snippet label()}
              Restrict user registration only to users belonging to a mapped
              group.
            {/snippet}
          </FormField>
          {#if $entity.restrictRegistrationToMappedUsers && !$entity.groupMap.length}
            <div
              class="mdc-typography--body2"
              style="font-size: small; margin-top: 1em;"
            >
              If you set this to true and don't map any groups, no users will be
              able to register an account through this LDAP source.
            </div>
          {/if}
        </LayoutCell>
      </LayoutGrid>

      <h5>Mapped Groups</h5>

      <DataTable table$aria-label="Current group mapping" style="width: 100%; ">
        <Head>
          <Row>
            <Cell>Remote DN</Cell>
            {#if !$clientConfig.emailUsernames}
              <Cell>Groupname</Cell>
            {/if}
            {#if $clientConfig.userFields.includes('name')}
              <Cell>Name</Cell>
            {/if}
            {#if $clientConfig.userFields.includes('email')}
              <Cell>Email</Cell>
            {/if}
            <Cell>Remove</Cell>
          </Row>
        </Head>
        <Body>
          {#each $entity.groupMap || [] as curMapping, index (curMapping.localGroup.guid)}
            <Row>
              <Cell>
                <Textfield
                  bind:value={curMapping.remoteDN}
                  label="Remote DN"
                  type="text"
                  style="width: 100%;"
                  input$autocapitalize="off"
                  input$autocomplete="off"
                  required
                />
              </Cell>
              {#if !$clientConfig.emailUsernames}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(
                      curMapping.localGroup.guid || '',
                    )}"
                    use:link>{curMapping.localGroup.groupname}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('name')}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(
                      curMapping.localGroup.guid || '',
                    )}"
                    use:link>{curMapping.localGroup.name}</a
                  ></Cell
                >
              {/if}
              {#if $clientConfig.userFields.includes('email')}
                <Cell
                  ><a
                    href="/groups/edit/{encodeURIComponent(
                      curMapping.localGroup.guid || '',
                    )}"
                    use:link>{curMapping.localGroup.email}</a
                  ></Cell
                >
              {/if}
              <Cell>
                <IconButton
                  onclick={() => {
                    $entity.groupMap?.splice(index, 1);
                    $entity = $entity;
                  }}
                >
                  <Icon tag="svg" viewBox="0 0 24 24">
                    <path fill="currentColor" d={mdiMinus} />
                  </Icon>
                </IconButton>
              </Cell>
            </Row>
          {:else}
            <Row>
              <Cell
                colspan={2 +
                  (!$clientConfig.emailUsernames ? 1 : 0) +
                  ($clientConfig.userFields.includes('name') ? 1 : 0) +
                  ($clientConfig.userFields.includes('email') ? 1 : 0)}
              >
                No groups mapped
              </Cell>
            </Row>
          {/each}
        </Body>
      </DataTable>

      <h6>Add Mapped Group</h6>

      <div class="solo-search-container solo-container">
        <Paper class="solo-paper" elevation={1}>
          <Icon class="solo-icon" tag="svg" viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiMagnify} />
          </Icon>
          <Input
            bind:value={mappedGroupSearch}
            onkeydown={mappedGroupSearchKeyDown}
            placeholder="Secondary Group Search"
            class="solo-input"
          />
        </Paper>
        <IconButton
          onclick={searchMappedGroups}
          disabled={mappedGroupSearch === ''}
          class="solo-fab"
          title="Search"
        >
          <Icon tag="svg" viewBox="0 0 24 24">
            <path fill="currentColor" d={mdiArrowRight} />
          </Icon>
        </IconButton>
      </div>

      {#if mappedGroupsSearching}
        <div
          style="display: flex; justify-content: center; align-items: center;"
        >
          <CircularProgress style="height: 32px; width: 32px;" indeterminate />
        </div>
      {:else if mappedGroups != null}
        <DataTable table$aria-label="Secondary group list" style="width: 100%;">
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
            {#each mappedGroups as curEntity, index (curEntity.guid)}
              <Row
                onclick={() => {
                  $entity.groupMap?.push({
                    remoteDN: '',
                    localGroup: curEntity,
                  });
                  mappedGroups?.splice(index, 1);
                  $entity = $entity;
                }}
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

    {#if activeTab === 'Users'}
      <h5 style="margin-top: 0;">Users</h5>

      <LayoutGrid style="padding: 0;">
        <LayoutCell span={12}>
          <Textfield
            bind:value={$entity.userFilter}
            label="User Filter"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
            required
          >
            {#snippet helper()}
              <HelperText
                >The LDAP search filter used to find all users. Use <code
                  >{`(objectClass=organizationalPerson)`}</code
                > for most directories.</HelperText
              >
            {/snippet}
          </Textfield>
        </LayoutCell>

        <LayoutCell span={12}>
          <Textfield
            bind:value={$entity.userSearchFilter}
            label="User Search Filter"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
            required
          >
            {#snippet helper()}
              <HelperText
                >The LDAP search filter used to find the user. Use <code
                  >{`{0}`}</code
                >
                as a placeholder for the username. Use
                <code>{`(sAMAccountName={0})`}</code>
                for Active Directory. Use
                <code>{`(uid={0})`}</code>
                for OpenLDAP. Use <code>{`(userPrincipalName={0})`}</code> if usernames
                in the directory are stored under the "userPrincipalName" attribute.</HelperText
              >
            {/snippet}
          </Textfield>
        </LayoutCell>
      </LayoutGrid>

      <div
        style="display: flex; flex-direction: column; gap: 1em; margin-top: 1em;"
      >
        <div
          style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 1em; align-items: baseline;"
        >
          <div style="flex-grow: 1;">
            <Textfield
              bind:value={testSearchUsername}
              label="Test Search Username"
              type="text"
              style="width: 100%;"
              input$autocapitalize="off"
              input$autocomplete="off"
            >
              {#snippet helper()}
                <HelperText
                  >Enter a username and the search results will be shown to you.
                  This can help with attribute mapping.</HelperText
                >
              {/snippet}
            </Textfield>
          </div>
          <Button onclick={testSearch} disabled={testSearching}>
            <Label>Test Search</Label>
          </Button>
        </div>

        <div
          style="display: flex; background: #333; border: 1px solid #ccc; border-radius: 1em; color: #ccc; padding: 1em; height: 200px; overflow: auto;"
        >
          {#if testSearching}
            <CircularProgress
              style="height: 45px; width: 45px; align-self: center; margin: 0 auto;"
              indeterminate
            />
          {:else}
            <pre style="padding: 0px; margin: 0; width: 100%;">{JSON.stringify(
                testSearchResults,
                null,
                2,
              )}</pre>
          {/if}
        </div>
      </div>

      <h5>Attribute Mapping</h5>

      <p>
        The mapping of attributes from Nymph to LDAP. The only required
        attribute is username.
      </p>

      <p>
        You can use arithmetic, binary and boolean logic, literals, and basic
        operators like concatenation (e.g. <code
          style="border: 1px solid gray; padding: .2em;"
          >{`givenName + ' ' + sn`}</code
        >).
      </p>

      <LayoutGrid style="padding: 0;">
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.nameFirst}
            input$emptyValueUndefined
            label="First Name"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.nameMiddle}
            input$emptyValueUndefined
            label="Middle Name"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.nameLast}
            input$emptyValueUndefined
            label="Last Name"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>

        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.name}
            input$emptyValueUndefined
            label="Display Name"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.phone}
            input$emptyValueUndefined
            label="Phone Number"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.email}
            input$emptyValueUndefined
            label="Email Address"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>

        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.username}
            label="Username"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
            required
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.avatar}
            input$emptyValueUndefined
            label="Avatar"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
        <LayoutCell span={4}>
          <Textfield
            bind:value={$entity.attributeMap.enabled}
            input$emptyValueUndefined
            label="Enabled"
            type="text"
            style="width: 100%;"
            input$autocapitalize="off"
            input$autocomplete="off"
          />
        </LayoutCell>
      </LayoutGrid>

      <div
        style="display: flex; flex-direction: column; gap: 1em; margin-top: 1em;"
      >
        <div
          style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 1em; align-items: baseline;"
        >
          <div style="flex-grow: 1;">
            <Textfield
              bind:value={testMappingUsername}
              label="Test Mapping Username"
              type="text"
              style="width: 100%;"
              input$autocapitalize="off"
              input$autocomplete="off"
            >
              {#snippet helper()}
                <HelperText
                  >Enter a username and the mapping results will be shown to
                  you. Make sure everything mapped correctly.</HelperText
                >
              {/snippet}
            </Textfield>
          </div>
          <Button onclick={testMapping} disabled={testMappinging}>
            <Label>Test Mapping</Label>
          </Button>
        </div>

        <div
          style="display: flex; background: #333; border: 1px solid #ccc; border-radius: 1em; color: #ccc; padding: 1em; height: 200px; overflow: auto;"
        >
          {#if testMappinging}
            <CircularProgress
              style="height: 45px; width: 45px; align-self: center; margin: 0 auto;"
              indeterminate
            />
          {:else}
            <pre style="padding: 0px; margin: 0; width: 100%;">{JSON.stringify(
                testMappingResults,
                null,
                2,
              )}</pre>
          {/if}
        </div>
      </div>

      <h5>Existing Users</h5>

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
              <Cell columnId="user-email" sortable={false}>
                <Label>Email</Label>
              </Cell>
            {/if}
            <Cell columnId="user-enabled">
              <Label>Enabled</Label>
              <IconButton>
                <Icon class="material-icons">arrow_upward</Icon>
              </IconButton>
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

    <div
      style="margin-top: 36px; display: flex; flex-direction: row; flex-wrap: wrap; gap: 1em;"
    >
      <Button variant="raised" onclick={saveEntity} disabled={saving}>
        <Label>Save LDAP Source</Label>
      </Button>
      {#if $entity.guid}
        <Button onclick={deleteEntity} disabled={saving}>
          <Label>Delete</Label>
        </Button>
      {/if}
      <div
        style="margin-inline-start: auto; display: flex; flex-direction: row; flex-wrap: wrap; gap: 1em;"
      >
        <Button
          onclick={() => {
            if (confirm('Are you sure? This will clear existing data.')) {
              $entity.$fillWithTestServer('forumsys');
              $entity = $entity;
            }
          }}
        >
          <Label>Fill ForumSys Test Server</Label>
        </Button>
        <Button
          onclick={() => {
            if (confirm('Are you sure? This will clear existing data.')) {
              $entity.$fillWithTestServer('freeipa');
              $entity = $entity;
            }
          }}
        >
          <Label>Fill FreeIPA Test Server</Label>
        </Button>
      </div>
    </div>
  </section>
{/if}

<script lang="ts">
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import { onMount, getContext } from 'svelte';
  import { link, pop, replace } from 'svelte-spa-router';
  import { ClientError } from '@nymphjs/client';
  import type {
    AdminGroupData,
    ClientConfig,
    CurrentUserData,
    RawLDAPEntry,
    RawLDAPSearchResult,
  } from '@nymphjs/tilmeld-client';
  import type {
    Group as GroupClass,
    User as UserClass,
    LDAPSource as LDAPSourceClass,
    AdminUserData,
  } from '@nymphjs/tilmeld-client';
  import queryParser from '@nymphjs/query-parser';
  import { mdiArrowLeft, mdiArrowRight, mdiMagnify, mdiMinus } from '@mdi/js';
  import CircularProgress from '@smui/circular-progress';
  import Tab from '@smui/tab';
  import TabBar from '@smui/tab-bar';
  import LayoutGrid, { Cell as LayoutCell } from '@smui/layout-grid';
  import FormField from '@smui/form-field';
  import Checkbox from '@smui/checkbox';
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
  import type Kitchen from '@smui/snackbar/kitchen';
  import { Icon, Label } from '@smui/common';

  import { nymph, LDAPSource, Group, User } from '../nymph.js';

  let { params }: { params: { guid: string } } = $props();

  let entity: Writable<LDAPSourceClass> = $state(
    writable(LDAPSource.factorySync()),
  );
  let activeTab: 'Connection' | 'Groups' | 'Users' = $state('Connection');
  let testListing = $state(false);
  let testListResults: RawLDAPSearchResult | null = $state(null);
  let mappedGroupSearch = $state('');
  let testSearchUsername = $state('');
  let testSearching = $state(false);
  let testSearchResults: RawLDAPEntry | null = $state(null);
  let testMappingUsername = $state('');
  let testMappinging = $state(false);
  let testMappingResults: { [k: string]: any } | null = $state(null);
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
  let loading = $state(true);

  let kitchen = getContext<Promise<Kitchen>>('kitchen');

  const clientConfig =
    getContext<Writable<ClientConfig | undefined>>('clientConfigStore');
  const user =
    getContext<Writable<(UserClass & CurrentUserData) | null | undefined>>(
      'userStore',
    );

  let previousParamGuid: string | null = null;
  $effect(() => {
    if (params?.guid != previousParamGuid) {
      previousParamGuid = params?.guid;
      handleGuidParam();
    }
  });

  $effect(() => {
    if (usersCurrentPage >= 0 && usersPerPage >= 0) {
      fillUsers();
    }
  });

  onMount(() => {
    const navigationCheck = (event: NavigateEvent) => {
      if (
        !$entity.$isDirty() ||
        !event.canIntercept ||
        event.downloadRequest ||
        event.formData ||
        confirm(
          'Are you sure you want to navigate away? You will lose your unsaved changes.',
        )
      ) {
        $entity.$clean();
        return;
      }

      event.preventDefault();
    };
    navigation.addEventListener('navigate', navigationCheck);
    return () => {
      navigation.removeEventListener('navigate', navigationCheck);
    };
  });

  async function handleGuidParam() {
    loading = true;
    try {
      $entity =
        params.guid === '+' || params.guid === ' ' || params.guid === '%20'
          ? await LDAPSource.factory()
          : await LDAPSource.factory(params.guid);
      await readyEntity();
    } catch (e: any) {
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    loading = false;
  }

  async function readyEntity() {
    await $entity.$wakeAll(1);

    $entity = $entity;

    await fillUsers();
  }

  async function testBind() {
    saving = true;
    try {
      await $entity.$testBind();
      (await kitchen).push({
        label: 'Successfully bound to LDAP server.',
        props: {
          class: 'success',
        },
      });
    } catch (e: any) {
      (await kitchen).push({
        label: `Bind failed: ${e?.message ?? 'Unknown error.'}`,
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    saving = false;
  }

  async function testList() {
    testListing = true;
    try {
      testListResults = await $entity.$testList();
    } catch (e: any) {
      console.log('error:', e);
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    testListing = false;
  }

  let mappedGroupsSearching = $state(false);
  let mappedGroups: (GroupClass & AdminGroupData)[] | undefined = $state();
  async function searchMappedGroups() {
    mappedGroupsSearching = true;
    if (mappedGroupSearch.trim() == '') {
      return;
    }
    try {
      const [options, ...selectors] = queryParser({
        query: mappedGroupSearch,
        entityClass: Group,
        defaultFields: ['groupname', 'name'],
        qrefMap: {
          User: {
            class: User,
            defaultFields: ['username', 'name'],
          },
          Group: {
            class: Group,
            defaultFields: ['groupname', 'name'],
          },
        },
      });
      mappedGroups = (
        await LDAPSource.getMappableGroups(options, selectors)
      ).filter((group) => {
        return !group.$inArray(
          $entity.groupMap.map((entry) => entry.localGroup) ?? [],
        );
      });
    } catch (e: any) {
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    mappedGroupsSearching = false;
  }
  function mappedGroupSearchKeyDown(event: CustomEvent | KeyboardEvent) {
    event = event as KeyboardEvent;
    if (event.key === 'Enter') searchMappedGroups();
  }

  async function testSearch() {
    testSearching = true;
    try {
      testSearchResults = await $entity.$testSearch(testSearchUsername);
    } catch (e: any) {
      console.log('error:', e);
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    testSearching = false;
  }

  async function testMapping() {
    testMappinging = true;
    try {
      const result = await $entity.$testMapping(testMappingUsername);
      if (result == null) {
        testMappingResults = result;
      } else {
        const json = result.toJSON();
        if (!('data' in json)) {
          testMappingResults = null;
        } else {
          delete json.data.source;
          testMappingResults = json.data;
        }
      }
    } catch (e: any) {
      console.log('error:', e);
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    testMappinging = false;
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
        const result = await $entity.$getUsers(
          usersPerPage,
          usersPerPage * usersCurrentPage,
          usersSortDirection === 'descending',
          usersSort.slice('user-'.length),
        );

        $users = result.entities;
        usersLength = result.count;
      }
    } catch (e: any) {
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    usersLoaded = true;
  }

  async function saveEntity() {
    saving = true;
    const newEntity = $entity.guid == null;
    try {
      await $entity.$save();
      await readyEntity();
      (await kitchen).push({
        label: 'Saved.',
        props: {
          class: 'success',
        },
      });
      if (newEntity) {
        replace(`/ldapsources/edit/${encodeURIComponent($entity.guid || '')}`);
      }
    } catch (e: any) {
      console.log('error:', e);
      (await kitchen).push({
        label: e?.message ?? 'An error occurred.',
        props: {
          class: e instanceof ClientError ? 'warning' : 'error',
        },
      });
    }
    saving = false;
  }

  async function deleteEntity() {
    if (
      confirm(
        'Are you sure you want to delete this? All users from this source will be removed.',
      )
    ) {
      saving = true;
      try {
        await $entity.$delete();
        pop();
      } catch (e: any) {
        (await kitchen).push({
          label: e?.message ?? 'An error occurred.',
          props: {
            class: e instanceof ClientError ? 'warning' : 'error',
          },
        });
      }
      saving = false;
    }
  }
</script>
