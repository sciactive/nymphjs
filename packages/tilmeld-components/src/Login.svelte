<svelte:options runes />

<div
  style="width: {width}; {style}"
  use:useActions={use}
  {...exclude(restProps, [
    'successRegisteredMessage$',
    'successLoginMessage$',
    'username$',
    'password$',
    'password2$',
    'name$',
    'email$',
    'phone$',
    'code$',
    'codeMessage$',
    'loginButton$',
    'registerButton$',
    'registerLink$',
    'loginLink$',
    'recoverLink$',
    'recover$',
    'progress$',
  ])}
>
  {#if $clientConfig == null || loading}
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress
        style="height: 32px; width: 32px;"
        indeterminate
        {...prefixFilter(restProps, 'progress$')}
      />
    </div>
  {:else if successRegisteredMessage}
    <div {...prefixFilter(restProps, 'successRegisteredMessage$')}>
      {successRegisteredMessage}
    </div>
  {:else if successLoginMessage}
    <div {...prefixFilter(restProps, 'successLoginMessage$')}>
      {successLoginMessage}
    </div>
  {:else if totp}
    <form onsubmit={(e) => e.preventDefault()}>
      <div {...prefixFilter(restProps, 'codeMessage$')}>
        Enter the 6-digit 2FA code from your authenticator app.
      </div>

      <div>
        <Textfield
          bind:value={code}
          label="2FA Code"
          style="width: 100%;"
          input$autocomplete="one-time-code"
          input$name="one-time-code"
          {...prefixFilter(restProps, 'code$')}
        />
      </div>

      {#if failureMessage}
        <div class="tilmeld-login-failure">
          {failureMessage}
        </div>
      {/if}

      <div class="tilmeld-login-buttons">
        <Button
          variant="raised"
          type="submit"
          onclick={login}
          {...prefixFilter(restProps, 'loginButton$')}
        >
          <Label>Log In</Label>
        </Button>
      </div>
    </form>
  {:else}
    <form onsubmit={(e) => e.preventDefault()}>
      <div>
        <Textfield
          bind:value={username}
          bind:this={usernameElem}
          label={$clientConfig.emailUsernames ? 'Email' : 'Username'}
          type={$clientConfig.emailUsernames ? 'email' : 'text'}
          style="width: 100%;"
          helperLine$style="width: 100%;"
          invalid={usernameVerified === false}
          input$autocomplete={$clientConfig.emailUsernames
            ? 'email'
            : 'username'}
          input$name={$clientConfig.emailUsernames ? 'email' : 'username'}
          input$autocapitalize="off"
          input$spellcheck="false"
          {...prefixFilter(restProps, 'username$')}
        >
          {#snippet helper()}
            <HelperText persistent>
              {#if mode !== 'login'}
                {usernameVerifiedMessage || ''}
              {/if}
            </HelperText>
          {/snippet}
        </Textfield>
      </div>

      <div>
        <Textfield
          bind:value={password}
          label="Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="{$clientConfig.allowRegistration &&
          mode !== 'login'
            ? 'new'
            : 'current'}-password"
          input$name="password"
          {...prefixFilter(restProps, 'password$')}
        />
      </div>

      {#if $clientConfig.allowRegistration && mode !== 'login'}
        <div>
          <Textfield
            bind:value={password2}
            label="Re-enter Password"
            type="password"
            style="width: 100%;"
            input$autocomplete="new-password"
            input$name="password2"
            {...prefixFilter(restProps, 'password2$')}
          />
        </div>

        {#if $clientConfig.regFields.includes('name')}
          <div>
            <Textfield
              bind:value={name}
              label="Name"
              type="text"
              style="width: 100%;"
              input$autocomplete="name"
              input$name="name"
              {...prefixFilter(restProps, 'name$')}
            />
          </div>
        {/if}

        {#if !$clientConfig.emailUsernames && $clientConfig.regFields.includes('email')}
          <div>
            <Textfield
              bind:value={email}
              label="Email"
              type="email"
              style="width: 100%;"
              input$autocomplete="email"
              input$name="email"
              input$autocapitalize="off"
              input$spellcheck="false"
              {...prefixFilter(restProps, 'email$')}
            />
          </div>
        {/if}

        {#if $clientConfig.regFields.includes('phone')}
          <div>
            <Textfield
              bind:value={phone}
              label="Phone Number"
              type="tel"
              style="width: 100%;"
              input$autocomplete="tel"
              input$name="phone"
              {...prefixFilter(restProps, 'phone$')}
            />
          </div>
        {/if}
      {/if}

      {@render additional?.()}

      {#if failureMessage}
        <div class="tilmeld-login-failure">
          {failureMessage}
        </div>
      {/if}

      <div class="tilmeld-login-buttons">
        {#if mode === 'login'}
          <Button
            variant="raised"
            type="submit"
            onclick={login}
            {...prefixFilter(restProps, 'loginButton$')}
          >
            <Label>Log In</Label>
          </Button>
        {:else}
          <Button
            variant="raised"
            type="submit"
            onclick={register}
            {...prefixFilter(restProps, 'registerButton$')}
          >
            <Label>Create Account</Label>
          </Button>
        {/if}
      </div>

      {#if $clientConfig.allowRegistration && showExistingUserToggle}
        <div class="tilmeld-login-action">
          {#if mode === 'login'}
            <a
              href={'javascript:void(0);'}
              onclick={() => (mode = 'register')}
              {...prefixFilter(restProps, 'registerLink$')}
            >
              Create an account.
            </a>
          {:else}
            <a
              href={'javascript:void(0);'}
              onclick={() => (mode = 'login')}
              {...prefixFilter(restProps, 'loginLink$')}
            >
              Log in to your account.
            </a>
          {/if}
        </div>
      {/if}

      {#if !hideRecovery && $clientConfig.userFields.includes('email') && $clientConfig.pwRecovery && mode === 'login'}
        <div class="tilmeld-login-action">
          <a
            href={'javascript:void(0);'}
            onclick={() => (recoverOpen = true)}
            {...prefixFilter(restProps, 'recoverLink$')}
          >
            I can't access my account.
          </a>
        </div>
        <Recover
          {User}
          bind:open={recoverOpen}
          bind:clientConfig
          {...prefixFilter(restProps, 'recover$')}
        />
      {/if}
    </form>
  {/if}
</div>

<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import CircularProgress from '@smui/circular-progress';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import type { ActionArray } from '@smui/common/internal';
  import { exclude, prefixFilter, useActions } from '@smui/common/internal';
  import type { SmuiElementPropMap } from '@smui/common';
  import type {
    User as UserClass,
    ClientConfig,
    UserData,
    CurrentUserData,
  } from '@nymphjs/tilmeld-client';
  import {
    login as loginAction,
    register as registerAction,
    checkUsername as checkUsernameAction,
    NeedTOTPError,
  } from '@nymphjs/tilmeld-client';
  import Recover from './Recover.svelte';

  type OwnProps = {
    /**
     * An array of Action or [Action, ActionProps] to be applied to the element.
     */
    use?: ActionArray;
    /**
     * A list of CSS styles.
     */
    style?: string;
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
     * Hide the recovery link that only appears if password recovery is on.
     */
    hideRecovery?: boolean;
    /**
     * Give focus to the username box (or email box) when the form is ready.
     */
    autofocus?: boolean;
    /**
     * This determines whether the 'Log In' or 'Sign Up' button is activated
     * and which corresponding form is shown.
     */
    mode?: 'login' | 'register';
    /**
     * Whether to show the 'Log In'/'Sign Up' switcher buttons.
     */
    showExistingUserToggle?: boolean;
    /**
     * The width of the form.
     */
    width?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    username?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    password?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    password2?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    name?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    email?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    phone?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    code?: string;
    /**
     * Provide this for anything else that should go up to the server.
     *
     * You can look for it in the User events.
     */
    additionalData?: { [k: string]: any };

    /**
     * A spot for additional content.
     */
    additional?: Snippet;

    /**
     * A callback to be called when a user is registered.
     */
    onregister?: (details: {
      user: UserClass & UserData & CurrentUserData;
    }) => void;
    /**
     * A callback to be called when a user is logged in.
     */
    onlogin?: (details: {
      user: UserClass & UserData & CurrentUserData;
    }) => void;
  };
  let {
    use = [],
    style = '',
    clientConfig = $bindable(writable(false as unknown as undefined)),
    User,
    hideRecovery = false,
    autofocus = true,
    mode = $bindable('login'),
    showExistingUserToggle = true,
    width = '220px',
    username = $bindable(''),
    password = $bindable(''),
    password2 = $bindable(''),
    name = $bindable(''),
    email = $bindable(''),
    phone = $bindable(''),
    code = $bindable(''),
    additionalData,
    additional,
    onregister,
    onlogin,
    ...restProps
  }: OwnProps & {
    [k in keyof SmuiElementPropMap['div'] as `successRegisteredMessage\$${k}`]?: SmuiElementPropMap['div'][k];
  } & {
    [k in keyof SmuiElementPropMap['div'] as `successLoginMessage\$${k}`]?: SmuiElementPropMap['div'][k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `username\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password2\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `name\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `email\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `phone\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `code\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof SmuiElementPropMap['div'] as `codeMessage\$${k}`]?: SmuiElementPropMap['div'][k];
  } & {
    [k in keyof ComponentProps<
      typeof CircularProgress
    > as `progress\$${k}`]?: ComponentProps<typeof CircularProgress>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `loginButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `registerButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `registerLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `loginLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `recoverLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof ComponentProps<
      typeof Recover
    > as `recover\$${k}`]?: ComponentProps<typeof Recover>[k];
  } = $props();

  let usernameElem: Textfield | undefined = $state();
  let successLoginMessage: string | undefined = $state();
  let successRegisteredMessage: string | undefined = $state();
  let failureMessage: string | undefined = $state();
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = $state();
  let usernameVerifiedMessage: string | undefined = $state();
  let totp = $state(false);
  let loading = $state(false);
  let recoverOpen = $state(false);

  const nameFirst = $derived(name?.match(/^(.*?)(?: ([^ ]+))?$/)?.[1] ?? '');
  const nameLast = $derived(name?.match(/^(.*?)(?: ([^ ]+))?$/)?.[2] ?? '');

  let _previousMode = mode;
  $effect(() => {
    if (mode !== _previousMode) {
      failureMessage = '';
      checkUsername(username);
      _previousMode = mode;
    }
  });

  $effect(() => {
    checkUsername(username);
  });

  onMount(async () => {
    if ($clientConfig === (false as unknown as undefined)) {
      $clientConfig = undefined;
      $clientConfig = await User.getClientConfig();
    }
    if (!$clientConfig.allowRegistration) {
      mode = 'login';
    }
    if (autofocus && usernameElem) {
      usernameElem.focus();
    }
  });

  async function login() {
    successLoginMessage = undefined;
    failureMessage = undefined;
    loading = true;
    try {
      const data = await loginAction(
        User,
        username,
        password,
        code,
        additionalData,
      );
      successLoginMessage = data.message;
      if (data.user) {
        onlogin?.({ user: data.user });
      }
    } catch (e: any) {
      if (e instanceof NeedTOTPError) {
        totp = true;
      } else {
        failureMessage = e?.message;
      }
    }
    loading = false;
  }

  async function register() {
    successRegisteredMessage = undefined;
    successLoginMessage = undefined;
    failureMessage = undefined;
    loading = true;
    try {
      const data = await registerAction(User, {
        username,
        usernameVerified: !!usernameVerified,
        password,
        password2,
        email,
        nameFirst,
        nameLast,
        phone,
        ...(additionalData ? { additionalData } : {}),
      });
      successRegisteredMessage = data.message;
      if (data.user) {
        onregister?.({ user: data.user });
      }
      if (data.loggedin) {
        successLoginMessage = data.message;
        if (data.user) {
          onlogin?.({ user: data.user });
        }
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    loading = false;
  }

  function checkUsername(newValue: string) {
    usernameVerified = undefined;
    usernameVerifiedMessage = undefined;
    if (usernameTimer) {
      clearTimeout(usernameTimer);
      usernameTimer = undefined;
    }
    if (newValue === '' || mode === 'login') {
      return;
    }
    usernameTimer = setTimeout(async () => {
      try {
        const data = await checkUsernameAction(User, newValue);
        usernameVerified = true;
        usernameVerifiedMessage = data.message;
      } catch (e: any) {
        usernameVerified = false;
        usernameVerifiedMessage = e?.message;
      }
    }, 400);
  }
</script>

<style>
  .tilmeld-login-buttons {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    margin-top: 1em;
  }
  .tilmeld-login-action {
    margin-top: 1em;
  }
  .tilmeld-login-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
</style>
