{#if clientConfig != null && user != null}
  <Dialog
    use={usePass}
    bind:open
    aria-labelledby="tilmeld-account-title"
    aria-describedby="tilmeld-account-content"
    surface$class="tilmeld-account-dialog-surface"
    {...exclude($$restProps, [
      'username$',
      'email$',
      'nameFirst$',
      'nameMiddle$',
      'nameLast$',
      'phone$',
      'changePasswordLink$',
      'revokeSessionsLink$',
      'closeButton$',
      'saveButton$',
      'changePassword$',
      'revokeSessions$',
      'twoFactor$',
      'progress$',
    ])}
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-account-title">{title}</Title>
    <Content id="tilmeld-account-content">
      {#if !clientConfig.emailUsernames && clientConfig.allowUsernameChange}
        <div>
          <Textfield
            bind:value={user.username}
            label="Username"
            type="text"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={usernameVerified === false}
            input$autocomplete="username"
            input$autocapitalize="off"
            input$spellcheck="false"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'username$')}
          >
            <HelperText persistent slot="helper">
              {usernameVerifiedMessage || ''}
            </HelperText>
          </Textfield>
        </div>
      {/if}

      {#if clientConfig.emailUsernames || clientConfig.userFields.indexOf('email') !== -1}
        <div>
          <Textfield
            bind:value={user.email}
            label="Email"
            type="email"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={emailVerified === false}
            input$autocomplete="email"
            input$autocapitalize="off"
            input$spellcheck="false"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'email$')}
          >
            <HelperText persistent slot="helper">
              {emailVerifiedMessage || ''}
            </HelperText>
          </Textfield>
        </div>
      {/if}

      {#if clientConfig.userFields.indexOf('name') !== -1}
        <div>
          <Textfield
            bind:value={user.nameFirst}
            label="First Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="given-name"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'nameFirst$')}
          />
        </div>

        <div>
          <Textfield
            bind:value={user.nameMiddle}
            label="Middle Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="additional-name"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'nameMiddle$')}
          />
        </div>

        <div>
          <Textfield
            bind:value={user.nameLast}
            label="Last Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="family-name"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'nameLast$')}
          />
        </div>
      {/if}

      {#if clientConfig.userFields.indexOf('phone') !== -1}
        <div>
          <Textfield
            bind:value={user.phone}
            label="Phone Number"
            type="tel"
            style="width: 100%;"
            input$autocomplete="tel"
            input$name="phone"
            input$emptyValueUndefined
            {...prefixFilter($$restProps, 'phone$')}
          />
        </div>
      {/if}

      <slot name="additional" />

      <div class="tilmeld-account-action">
        <a
          href={'javascript:void(0);'}
          on:click={() => {
            open = false;
            changePasswordOpen = true;
          }}
          {...prefixFilter($$restProps, 'changePasswordLink$')}
        >
          Change your password.
        </a>
      </div>

      <div class="tilmeld-account-action">
        <a
          href={'javascript:void(0);'}
          on:click={() => {
            open = false;
            revokeTokensOpen = true;
          }}
          {...prefixFilter($$restProps, 'revokeTokensLink$')}
        >
          Log out of other sessions.
        </a>

        <div class="tilmeld-account-action">
          <a
            href={'javascript:void(0);'}
            on:click={() => {
              open = false;
              twoFactorOpen = true;
            }}
            {...prefixFilter($$restProps, 'twoFactor$')}
          >
            {#if hasTOTPSecret === false}
              Enable two factor authentication (2FA).
            {:else}
              Manage two factor authentication (2FA).
            {/if}
          </a>
        </div>

        {#if failureMessage}
          <div class="tilmeld-account-failure">
            {failureMessage}
          </div>
        {/if}

        {#if loading}
          <div class="tilmeld-account-loading">
            <CircularProgress
              style="height: 24px; width: 24px;"
              indeterminate
              {...prefixFilter($$restProps, 'progress$')}
            />
          </div>
        {/if}
      </div>
    </Content>
    <Actions>
      <Button disabled={loading} {...prefixFilter($$restProps, 'closeButton$')}>
        <Label>Close</Label>
      </Button>
      <Button
        on:click$preventDefault$stopPropagation={save}
        disabled={loading}
        {...prefixFilter($$restProps, 'saveButton$')}
      >
        <Label>Save Changes</Label>
      </Button>
    </Actions>
  </Dialog>

  <ChangePassword
    {User}
    bind:open={changePasswordOpen}
    bind:user
    {...prefixFilter($$restProps, 'changePassword$')}
  />

  <RevokeTokens
    {User}
    bind:open={revokeTokensOpen}
    bind:user
    {...prefixFilter($$restProps, 'revokeTokens$')}
  />

  <TwoFactor
    {User}
    bind:open={twoFactorOpen}
    bind:user
    bind:hasTOTPSecret
    {...prefixFilter($$restProps, 'twoFactor$')}
  />
{/if}

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get_current_component } from 'svelte/internal';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import Button, { Label } from '@smui/button';
  import type { ActionArray } from '@smui/common/internal';
  import {
    forwardEventsBuilder,
    exclude,
    prefixFilter,
  } from '@smui/common/internal';
  import type { ClientConfig, CurrentUserData } from '@nymphjs/tilmeld-client';
  import type { User as UserClass } from '@nymphjs/tilmeld-client';
  import ChangePassword from './ChangePassword.svelte';
  import RevokeTokens from './RevokeTokens.svelte';
  import TwoFactor from './TwoFactor.svelte';

  const forwardEvents = forwardEventsBuilder(get_current_component());

  export let use: ActionArray = [];
  $: usePass = [forwardEvents, ...use] as ActionArray;
  export let open = false;
  export let title = 'Your Account';
  export let clientConfig: ClientConfig | undefined = undefined;
  export let User: typeof UserClass;
  export let user: (UserClass & CurrentUserData) | undefined = undefined;

  let loading = false;
  let originalUsername: string | undefined = undefined;
  let originalEmail: string | undefined = undefined;
  let failureMessage: string | undefined = undefined;
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = undefined;
  let usernameVerifiedMessage: string | undefined = undefined;
  let emailTimer: NodeJS.Timeout | undefined = undefined;
  let emailVerified: boolean | undefined = undefined;
  let emailVerifiedMessage: string | undefined = undefined;
  let hasTOTPSecret: boolean | null = null;
  let changePasswordOpen = false;
  let revokeTokensOpen = false;
  let twoFactorOpen = false;

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    user = currentUser;
    originalUsername = user?.username;
    originalEmail = user?.email;
  };
  const onLogout = () => {
    user = undefined;
    originalUsername = undefined;
    originalEmail = undefined;
  };

  $: if (user && user.username !== originalUsername) {
    checkUsername();
  } else {
    if (usernameTimer) {
      clearTimeout(usernameTimer);
    }
    usernameVerified = true;
    usernameVerifiedMessage = undefined;
  }

  $: if (user && user.email !== originalEmail) {
    checkEmail();
  } else {
    if (emailTimer) {
      clearTimeout(emailTimer);
    }
    emailVerified = true;
    emailVerifiedMessage = undefined;
  }

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    if (user === undefined) {
      user = (await User.current()) ?? undefined;
    }
    originalUsername = user?.username;
    originalEmail = user?.email;
  });
  onMount(async () => {
    if (clientConfig === undefined) {
      clientConfig = await User.getClientConfig();
    }
  });

  onDestroy(() => {
    User.off('login', onLogin);
    User.off('logout', onLogout);
  });

  async function save() {
    if (user == null) {
      return;
    }

    failureMessage = undefined;
    loading = true;

    if (clientConfig?.emailUsernames) {
      user.username = user.email;
    }

    try {
      if (await user.$save()) {
        originalEmail = user.email;
        open = false;
        usernameVerifiedMessage = undefined;
        emailVerifiedMessage = undefined;
      } else {
        failureMessage = 'Error saving account changes.';
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    loading = false;
  }

  function checkUsername() {
    usernameVerified = undefined;
    usernameVerifiedMessage = undefined;
    if (usernameTimer) {
      clearTimeout(usernameTimer);
      usernameTimer = undefined;
    }
    usernameTimer = setTimeout(async () => {
      try {
        const data = await user?.$checkUsername();
        usernameVerified = data?.result ?? false;
        usernameVerifiedMessage =
          data?.message ?? 'Error getting verification.';
      } catch (e: any) {
        usernameVerified = false;
        usernameVerifiedMessage = e?.message;
      }
    }, 400);
  }

  function checkEmail() {
    emailVerified = undefined;
    emailVerifiedMessage = undefined;
    if (emailTimer) {
      clearTimeout(emailTimer);
      emailTimer = undefined;
    }
    emailTimer = setTimeout(async () => {
      try {
        const data = await user?.$checkEmail();
        emailVerified = data?.result ?? false;
        emailVerifiedMessage = data?.message ?? 'Error getting verification.';
      } catch (e: any) {
        emailVerified = false;
        emailVerifiedMessage = e?.message;
      }
    }, 400);
  }
</script>

<style>
  :global(.mdc-dialog .mdc-dialog__surface.tilmeld-account-dialog-surface) {
    width: 360px;
    max-width: calc(100vw - 32px);
  }
  .tilmeld-account-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
  .tilmeld-account-action {
    margin-top: 1em;
  }
  .tilmeld-account-loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
