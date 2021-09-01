{#if clientConfig == null || registering || loggingIn}
  <CircularProgress style="height: 32px; width: 32px;" indeterminate />
{:else}
  <div style="width: {width};">
    {#if successRegisteredMessage}
      <div>
        {successRegisteredMessage}
      </div>
    {:else if successLoginMessage}
      <div>
        {successLoginMessage}
      </div>
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
          >
            <HelperText persistent slot="helper">
              {#if !existingUser}
                {usernameVerifiedMessage ?? ''}
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
            input$autocomplete="{clientConfig.allowRegistration && !existingUser
              ? 'new'
              : 'current'}-password"
            input$name="password"
          />
        </div>
        {#if clientConfig.allowRegistration && !existingUser}
          <div>
            <Textfield
              bind:value={password2}
              label="Re-enter Password"
              type="password"
              style="width: 100%;"
              input$autocomplete="new-password"
              input$name="password2"
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
              />
            </div>
          {/if}
        {/if}
        {#if failureMessage}
          <div class="login-form-failure">
            {failureMessage}
          </div>
        {/if}

        <div class="login-form-buttons">
          {#if existingUser}
            <Button variant="raised" type="submit" on:click={login}>
              <Label>Log In</Label>
            </Button>
          {:else}
            <Button variant="raised" type="submit" on:click={register}>
              <Label>Create Account</Label>
            </Button>
          {/if}
        </div>

        {#if clientConfig.allowRegistration && showExistingUserToggle}
          <div class="login-form-action">
            {#if existingUser}
              <a
                href="javascript:void(0);"
                on:click={() => (existingUser = false)}
              >
                Create an account.
              </a>
            {:else}
              <a
                href="javascript:void(0);"
                on:click={() => (existingUser = true)}
              >
                Log in to your account.
              </a>
            {/if}
          </div>
        {/if}

        {#if !hideRecovery && clientConfig.pwRecovery && existingUser}
          <div class="login-form-action">
            <Recover account={username} />
          </div>
        {/if}
      </form>
    {/if}
  </div>
{/if}

<script lang="ts">
  import { onMount, createEventDispatcher, SvelteComponent } from 'svelte';
  import CircularProgress from '@smui/circular-progress';
  import Button, { Label } from '@smui/button';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text/index';
  import {
    getClientConfig,
    login as loginAction,
    register as registerAction,
    checkUsername as checkUsernameAction,
    ClientConfig,
  } from '@nymphjs/tilmeld-client';
  import Recover from './Recover.svelte';

  const dispatch = createEventDispatcher();

  /** Hide the recovery link that only appears if password recovery is on. */
  export let hideRecovery = false;
  /** Give focus to the username box (or email box) when the form is ready. */
  export let autofocus = true;
  /** This determines whether the 'Log In' or 'Sign Up' button is activated and which corresponding form is shown. */
  export let existingUser = true;
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

  let clientConfig: ClientConfig | null = null;
  let usernameElem: SvelteComponent;
  let successLoginMessage: string | null = null;
  let successRegisteredMessage: string | null = null;
  let failureMessage: string | null = null;
  let usernameTimer: NodeJS.Timeout | null = null;
  let usernameVerified: boolean | null = null;
  let usernameVerifiedMessage: string | null = null;
  let registering = false;
  let loggingIn = false;

  $: nameFirst = name.match(/^(.*?)(?: ([^ ]+))?$/)[1] || '';
  $: nameLast = name.match(/^(.*?)(?: ([^ ]+))?$/)[2] || '';

  let _previousExistingUser = existingUser;
  $: if (existingUser !== _previousExistingUser) {
    failureMessage = '';
    checkUsername(username);
    _previousExistingUser = existingUser;
  }

  $: {
    checkUsername(username);
  }

  onMount(async () => {
    clientConfig = await getClientConfig();
    if (!clientConfig.allowRegistration) {
      existingUser = true;
    }
    if (autofocus && usernameElem) {
      usernameElem.focus();
    }
  });

  async function login() {
    successLoginMessage = null;
    failureMessage = null;
    loggingIn = true;
    try {
      const data = await loginAction(username, password);
      successLoginMessage = data.message;
      dispatch('login', { user: data.user });
    } catch (e) {
      failureMessage = e.message;
    }
    loggingIn = false;
  }

  async function register() {
    successRegisteredMessage = null;
    successLoginMessage = null;
    failureMessage = null;
    registering = true;
    try {
      const data = await registerAction({
        username,
        usernameVerified,
        password,
        password2,
        email,
        nameFirst,
        nameLast,
        phone,
      });
      successRegisteredMessage = data.message;
      dispatch('register', { user: data.user });
      if (data.loggedin) {
        successLoginMessage = data.message;
        dispatch('login', { user: data.user });
      }
    } catch (e) {
      failureMessage = e.message;
    }
    registering = false;
  }

  function checkUsername(newValue: string) {
    usernameVerified = null;
    usernameVerifiedMessage = null;
    if (usernameTimer) {
      clearTimeout(usernameTimer);
      usernameTimer = null;
    }
    if (newValue === '' || existingUser) {
      return;
    }
    usernameTimer = setTimeout(() => {
      checkUsernameAction(newValue).then((data) => {
        usernameVerified = data.result;
        usernameVerifiedMessage = data.message;
      });
    }, 400);
  }
</script>

<style>
  .login-form-buttons {
    display: flex;
    flex-direction: row;
    justify-content: start;
    align-items: center;
    margin-top: 1em;
  }
  .login-form-action {
    margin-top: 1em;
  }
  .login-form-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
</style>
