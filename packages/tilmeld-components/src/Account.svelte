<svelte:options runes />

{#if $clientConfig != null && $user != null}
  <Dialog
    {use}
    bind:open
    aria-labelledby="tilmeld-account-title"
    aria-describedby="tilmeld-account-content"
    surface$class="tilmeld-account-dialog-surface"
    {...exclude(restProps, [
      'username$',
      'email$',
      'nameFirst$',
      'nameMiddle$',
      'nameLast$',
      'phone$',
      'changePasswordLink$',
      'revokeTokensLink$',
      'closeButton$',
      'saveButton$',
      'changePassword$',
      'revokeTokens$',
      'twoFactor$',
      'progress$',
    ])}
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-account-title">{title}</Title>
    <Content id="tilmeld-account-content">
      {#if !$clientConfig.emailUsernames && $clientConfig.allowUsernameChange}
        <div>
          <Textfield
            bind:value={$user.username}
            label="Username"
            type="text"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={usernameVerified === false}
            input$autocomplete="username"
            input$autocapitalize="off"
            input$spellcheck="false"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'username$')}
          >
            {#snippet helper()}
              <HelperText persistent>
                {usernameVerifiedMessage || ''}
              </HelperText>
            {/snippet}
          </Textfield>
        </div>
      {/if}

      {#if $clientConfig.emailUsernames || $clientConfig.userFields.includes('email')}
        <div>
          <Textfield
            bind:value={$user.email}
            label="Email"
            type="email"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={emailVerified === false}
            input$autocomplete="email"
            input$autocapitalize="off"
            input$spellcheck="false"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'email$')}
          >
            {#snippet helper()}
              <HelperText persistent>
                {emailVerifiedMessage || ''}
              </HelperText>
            {/snippet}
          </Textfield>
        </div>
      {/if}

      {#if $clientConfig.userFields.includes('name')}
        <div>
          <Textfield
            bind:value={$user.nameFirst}
            label="First Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="given-name"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'nameFirst$')}
          />
        </div>

        <div>
          <Textfield
            bind:value={$user.nameMiddle}
            label="Middle Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="additional-name"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'nameMiddle$')}
          />
        </div>

        <div>
          <Textfield
            bind:value={$user.nameLast}
            label="Last Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="family-name"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'nameLast$')}
          />
        </div>
      {/if}

      {#if $clientConfig.userFields.includes('phone')}
        <div>
          <Textfield
            bind:value={$user.phone}
            label="Phone Number"
            type="tel"
            style="width: 100%;"
            input$autocomplete="tel"
            input$name="phone"
            input$emptyValueUndefined
            {...prefixFilter(restProps, 'phone$')}
          />
        </div>
      {/if}

      {@render additional?.()}

      <div class="tilmeld-account-action">
        <a
          href={'javascript:void(0);'}
          onclick={() => {
            open = false;
            changePasswordOpen = true;
          }}
          {...prefixFilter(restProps, 'changePasswordLink$')}
        >
          Change your password.
        </a>
      </div>

      <div class="tilmeld-account-action">
        <a
          href={'javascript:void(0);'}
          onclick={() => {
            open = false;
            revokeTokensOpen = true;
          }}
          {...prefixFilter(restProps, 'revokeTokensLink$')}
        >
          Log out of other sessions.
        </a>

        <div class="tilmeld-account-action">
          <a
            href={'javascript:void(0);'}
            onclick={() => {
              open = false;
              twoFactorOpen = true;
            }}
            {...prefixFilter(restProps, 'twoFactor$')}
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
              {...prefixFilter(restProps, 'progress$')}
            />
          </div>
        {/if}
      </div>
    </Content>
    <Actions>
      <Button disabled={loading} {...prefixFilter(restProps, 'closeButton$')}>
        <Label>Close</Label>
      </Button>
      <Button
        onclick={preventDefault(stopPropagation(save))}
        disabled={loading}
        {...prefixFilter(restProps, 'saveButton$')}
      >
        <Label>Save Changes</Label>
      </Button>
    </Actions>
  </Dialog>

  <ChangePassword
    {User}
    bind:open={changePasswordOpen}
    bind:user
    {...prefixFilter(restProps, 'changePassword$')}
  />

  <RevokeTokens
    {User}
    bind:open={revokeTokensOpen}
    bind:user
    {...prefixFilter(restProps, 'revokeTokens$')}
  />

  <TwoFactor
    {User}
    bind:open={twoFactorOpen}
    bind:user
    bind:hasTOTPSecret
    {...prefixFilter(restProps, 'twoFactor$')}
  />
{/if}

<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import Button, { Label } from '@smui/button';
  import type { ActionArray } from '@smui/common/internal';
  import { exclude, prefixFilter } from '@smui/common/internal';
  import { preventDefault, stopPropagation } from '@smui/common/events';
  import type { SmuiElementPropMap } from '@smui/common';
  import type { ClientConfig, CurrentUserData } from '@nymphjs/tilmeld-client';
  import type { User as UserClass } from '@nymphjs/tilmeld-client';
  import ChangePassword from './ChangePassword.svelte';
  import RevokeTokens from './RevokeTokens.svelte';
  import TwoFactor from './TwoFactor.svelte';

  type OwnProps = {
    /**
     * An array of Action or [Action, ActionProps] to be applied to the element.
     */
    use?: ActionArray;
    /**
     * Whether the dialog is open.
     */
    open?: boolean;
    /**
     * The title of the dialog.
     */
    title?: string;
    /**
     * A writable store of the Nymph client config.
     *
     * It will be retrieved from the server if not provided.
     */
    clientConfig?: Writable<ClientConfig | undefined>;
    /**
     * The User class from Nymph.
     */
    User: typeof UserClass;
    /**
     * A writable store of the current user.
     *
     * It will be retrieved from the server if not provided.
     */
    user?: Writable<(UserClass & CurrentUserData) | null | undefined>;

    /**
     * A spot for additional content.
     */
    additional?: Snippet;
  };
  let {
    use = [],
    open = $bindable(false),
    title = 'Your Account',
    clientConfig = $bindable(writable(false as unknown as undefined)),
    User,
    user = $bindable(writable(false as unknown as undefined)),
    additional,
    ...restProps
  }: OwnProps & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `username\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `email\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `nameFirst\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `nameMiddle\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `nameLast\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `phone\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `changePasswordLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `revokeTokensLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof ComponentProps<
      typeof CircularProgress
    > as `progress\$${k}`]?: ComponentProps<typeof CircularProgress>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `closeButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `saveButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } & {
    [k in keyof ComponentProps<
      typeof ChangePassword
    > as `changePassword\$${k}`]?: ComponentProps<typeof ChangePassword>[k];
  } & {
    [k in keyof ComponentProps<
      typeof RevokeTokens
    > as `revokeTokens\$${k}`]?: ComponentProps<typeof RevokeTokens>[k];
  } & {
    [k in keyof ComponentProps<
      typeof TwoFactor
    > as `twoFactor\$${k}`]?: ComponentProps<typeof TwoFactor>[k];
  } = $props();

  let loading = $state(false);
  let originalUsername: string | undefined = $user?.username;
  let originalEmail: string | undefined = $user?.email;
  let failureMessage: string | undefined = $state();
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = $state();
  let usernameVerifiedMessage: string | undefined = $state();
  let emailTimer: NodeJS.Timeout | undefined = undefined;
  let emailVerified: boolean | undefined = $state();
  let emailVerifiedMessage: string | undefined = $state();
  let hasTOTPSecret: boolean | null = $state(null);
  let changePasswordOpen = $state(false);
  let revokeTokensOpen = $state(false);
  let twoFactorOpen = $state(false);

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    $user = currentUser;
    originalUsername = $user?.username;
    originalEmail = $user?.email;
  };
  const onLogout = () => {
    $user = null;
    originalUsername = undefined;
    originalEmail = undefined;
  };

  $effect(() => {
    if ($user && $user.username !== originalUsername) {
      if ($user.$isDirty('username')) {
        checkUsername();
      } else {
        originalUsername = $user.username;
      }
    } else {
      if (usernameTimer) {
        clearTimeout(usernameTimer);
      }
      usernameVerified = true;
      usernameVerifiedMessage = undefined;
    }
  });

  $effect(() => {
    if ($user && $user.email !== originalEmail) {
      if ($user.$isDirty('email')) {
        checkEmail();
      } else {
        originalEmail = $user.email;
      }
    } else {
      if (emailTimer) {
        clearTimeout(emailTimer);
      }
      emailVerified = true;
      emailVerifiedMessage = undefined;
    }
  });

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    if ($user === (false as unknown as undefined)) {
      $user = undefined;
      $user = await User.current();
    }
    originalUsername = $user?.username;
    originalEmail = $user?.email;
  });
  onMount(async () => {
    if ($clientConfig === (false as unknown as undefined)) {
      $clientConfig = undefined;
      $clientConfig = await User.getClientConfig();
    }
  });

  onDestroy(() => {
    User.off('login', onLogin);
    User.off('logout', onLogout);
  });

  async function save() {
    if ($user == null) {
      return;
    }

    failureMessage = undefined;
    loading = true;

    if ($clientConfig?.emailUsernames) {
      $user.username = $user.email;
    }

    try {
      if (await $user.$save()) {
        originalEmail = $user.email;
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
        const data = await $user?.$checkUsername();
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
        const data = await $user?.$checkEmail();
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
