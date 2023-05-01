<div
  style="width: {width}; {style}"
  use:useActions={use}
  use:forwardEvents
  {...exclude($$restProps, [
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
  {#if clientConfig == null || loading}
    <div style="display: flex; justify-content: center; align-items: center;">
      <CircularProgress
        style="height: 32px; width: 32px;"
        indeterminate
        {...prefixFilter($$restProps, 'progress$')}
      />
    </div>
  {:else if successRegisteredMessage}
    <div {...prefixFilter($$restProps, 'successRegisteredMessage$')}>
      {successRegisteredMessage}
    </div>
  {:else if successLoginMessage}
    <div {...prefixFilter($$restProps, 'successLoginMessage$')}>
      {successLoginMessage}
    </div>
  {:else if totp}
    <form on:submit|preventDefault>
      <div {...prefixFilter($$restProps, 'codeMessage$')}>
        Enter the 6-digit 2FA code from your authenticator app.
      </div>

      <div>
        <Textfield
          bind:value={code}
          label="2FA Code"
          style="width: 100%;"
          input$autocomplete="one-time-code"
          input$name="one-time-code"
          {...prefixFilter($$restProps, 'code$')}
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
          on:click={login}
          {...prefixFilter($$restProps, 'loginButton$')}
        >
          <Label>Log In</Label>
        </Button>
      </div>
    </form>
  {:else}
    <form on:submit|preventDefault>
      <div>
        <Textfield
          bind:value={username}
          bind:this={usernameElem}
          label={clientConfig.emailUsernames ? 'Email' : 'Username'}
          type={clientConfig.emailUsernames ? 'email' : 'text'}
          style="width: 100%;"
          helperLine$style="width: 100%;"
          invalid={usernameVerified === false}
          input$autocomplete={clientConfig.emailUsernames
            ? 'email'
            : 'username'}
          input$name={clientConfig.emailUsernames ? 'email' : 'username'}
          input$autocapitalize="off"
          input$spellcheck="false"
          {...prefixFilter($$restProps, 'username$')}
        >
          <HelperText persistent slot="helper">
            {#if mode !== 'login'}
              {usernameVerifiedMessage || ''}
            {/if}
          </HelperText>
        </Textfield>
      </div>

      <div>
        <Textfield
          bind:value={password}
          label="Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="{clientConfig.allowRegistration &&
          mode !== 'login'
            ? 'new'
            : 'current'}-password"
          input$name="password"
          {...prefixFilter($$restProps, 'password$')}
        />
      </div>

      {#if clientConfig.allowRegistration && mode !== 'login'}
        <div>
          <Textfield
            bind:value={password2}
            label="Re-enter Password"
            type="password"
            style="width: 100%;"
            input$autocomplete="new-password"
            input$name="password2"
            {...prefixFilter($$restProps, 'password2$')}
          />
        </div>

        {#if clientConfig.regFields.indexOf('name') !== -1}
          <div>
            <Textfield
              bind:value={name}
              label="Name"
              type="text"
              style="width: 100%;"
              input$autocomplete="name"
              input$name="name"
              {...prefixFilter($$restProps, 'name$')}
            />
          </div>
        {/if}

        {#if !clientConfig.emailUsernames && clientConfig.regFields.indexOf('email') !== -1}
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
              {...prefixFilter($$restProps, 'email$')}
            />
          </div>
        {/if}

        {#if clientConfig.regFields.indexOf('phone') !== -1}
          <div>
            <Textfield
              bind:value={phone}
              label="Phone Number"
              type="tel"
              style="width: 100%;"
              input$autocomplete="tel"
              input$name="phone"
              {...prefixFilter($$restProps, 'phone$')}
            />
          </div>
        {/if}
      {/if}

      <slot name="additional" />

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
            on:click={login}
            {...prefixFilter($$restProps, 'loginButton$')}
          >
            <Label>Log In</Label>
          </Button>
        {:else}
          <Button
            variant="raised"
            type="submit"
            on:click={register}
            {...prefixFilter($$restProps, 'registerButton$')}
          >
            <Label>Create Account</Label>
          </Button>
        {/if}
      </div>

      {#if clientConfig.allowRegistration && showExistingUserToggle}
        <div class="tilmeld-login-action">
          {#if mode === 'login'}
            <a
              href={'javascript:void(0);'}
              on:click={() => (mode = 'register')}
              {...prefixFilter($$restProps, 'registerLink$')}
            >
              Create an account.
            </a>
          {:else}
            <a
              href={'javascript:void(0);'}
              on:click={() => (mode = 'login')}
              {...prefixFilter($$restProps, 'loginLink$')}
            >
              Log in to your account.
            </a>
          {/if}
        </div>
      {/if}

      {#if !hideRecovery && clientConfig.pwRecovery && mode === 'login'}
        <div class="tilmeld-login-action">
          <a
            href={'javascript:void(0);'}
            on:click={() => (recoverOpen = true)}
            {...prefixFilter($$restProps, 'recoverLink$')}
          >
            I can't access my account.
          </a>
        </div>
        <Recover
          {User}
          bind:open={recoverOpen}
          bind:clientConfig
          {...prefixFilter($$restProps, 'recover$')}
        />
      {/if}
    </form>
  {/if}
</div>

<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { get_current_component } from 'svelte/internal';
  import CircularProgress from '@smui/circular-progress';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text';
  import type { ActionArray } from '@smui/common/internal';
  import {
    forwardEventsBuilder,
    exclude,
    prefixFilter,
    useActions,
  } from '@smui/common/internal';
  import type {
    User as UserClass,
    ClientConfig,
  } from '@nymphjs/tilmeld-client';
  import {
    login as loginAction,
    register as registerAction,
    checkUsername as checkUsernameAction,
    NeedTOTPError,
  } from '@nymphjs/tilmeld-client';
  import Recover from './Recover.svelte';

  const forwardEvents = forwardEventsBuilder(get_current_component());
  const dispatch = createEventDispatcher();

  export let use: ActionArray = [];
  export let style = '';
  export let clientConfig: ClientConfig | undefined = undefined;
  export let User: typeof UserClass;

  /** Hide the recovery link that only appears if password recovery is on. */
  export let hideRecovery = false;
  /** Give focus to the username box (or email box) when the form is ready. */
  export let autofocus = true;
  /** This determines whether the 'Log In' or 'Sign Up' button is activated and which corresponding form is shown. */
  export let mode: 'login' | 'register' = 'login';
  /** Whether to show the 'Log In'/'Sign Up' switcher buttons. */
  export let showExistingUserToggle = true;
  /** The width of the form. */
  export let width = '220px';

  /** User provided. You can bind to it if you need to. */
  export let username = '';
  /** User provided. You can bind to it if you need to. */
  export let password = '';
  /** User provided. You can bind to it if you need to. */
  export let password2 = '';
  /** User provided. You can bind to it if you need to. */
  export let name = '';
  /** User provided. You can bind to it if you need to. */
  export let email = '';
  /** User provided. You can bind to it if you need to. */
  export let phone = '';
  /** User provided. You can bind to it if you need to. */
  export let code = '';

  /** Provide this for anything else that should go up to the server. You can look for it in the User events. */
  export let additionalData: { [k: string]: any } | undefined = undefined;

  let usernameElem: Textfield;
  let successLoginMessage: string | undefined = undefined;
  let successRegisteredMessage: string | undefined = undefined;
  let failureMessage: string | undefined = undefined;
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = undefined;
  let usernameVerifiedMessage: string | undefined = undefined;
  let totp = false;
  let loading = false;
  let recoverOpen = false;

  $: nameFirst = name?.match(/^(.*?)(?: ([^ ]+))?$/)?.[1] ?? '';
  $: nameLast = name?.match(/^(.*?)(?: ([^ ]+))?$/)?.[2] ?? '';

  let _previousMode = mode;
  $: if (mode !== _previousMode) {
    failureMessage = '';
    checkUsername(username);
    _previousMode = mode;
  }

  $: {
    checkUsername(username);
  }

  onMount(async () => {
    if (clientConfig === undefined) {
      clientConfig = await User.getClientConfig();
    }
    if (!clientConfig.allowRegistration) {
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
        additionalData
      );
      successLoginMessage = data.message;
      dispatch('login', { user: data.user });
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
      dispatch('register', { user: data.user });
      if (data.loggedin) {
        successLoginMessage = data.message;
        dispatch('login', { user: data.user });
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
