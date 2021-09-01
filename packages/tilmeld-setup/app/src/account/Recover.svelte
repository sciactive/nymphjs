{#if clientConfig == null || recovering}
  <CircularProgress style="height: 32px; width: 32px;" indefinite />
{:else}
  <a href="javascript:void(0);" on:click={() => (showDialog = true)}>
    {linkText}
  </a>

  <Dialog
    bind:open={showDialog}
    aria-labelledby="tilmeld-recovery-title"
    aria-describedby="tilmeld-recovery-content"
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-recovery-title">Recover Your Account</Title>
    <Content id="tilmeld-recovery-content">
      {#if recovering}
        <CircularProgress style="height: 64px; width: 64px;" indefinite />
      {:else if successRecoveredMessage}
        {successRecoveredMessage}
      {:else}
        {#if !hasSentSecret}
          {#if !clientConfig.emailUsernames}
            <div>
              <FormField style="margin-right: 1em;">
                <Radio bind:group={recoveryType} value="password" />
                <span slot="label">I don't know my password.</span>
              </FormField>
              <FormField style="margin-right: 1em;">
                <Radio bind:group={recoveryType} value="username" />
                <span slot="label">I don't know my username.</span>
              </FormField>
            </div>
          {/if}
          <div>
            {#if recoveryType === 'password'}
              <p>
                To reset your password, type the {clientConfig.emailUsernames
                  ? 'email'
                  : 'username'}
                you use to sign in below.
              </p>
            {/if}
            {#if recoveryType === 'username'}
              <p>
                To get your username, type your email as you entered it when
                creating your account.
              </p>
            {/if}
          </div>
          <div>
            <Textfield
              bind:this={accountElem}
              bind:value={account}
              label={clientConfig.emailUsernames || recoveryType === 'username'
                ? 'Email Address'
                : 'Username'}
              type={clientConfig.emailUsernames || recoveryType === 'username'
                ? 'email'
                : 'text'}
              input$autocapitalize="off"
              input$spellcheck="false"
            />
          </div>
          {#if account !== '' && recoveryType === 'password'}
            <div class="recover-form-action">
              <a
                href="javascript:void(0);"
                on:click={() => (hasSentSecret = true)}
              >
                Already Got a Code?
              </a>
            </div>
          {/if}
        {:else}
          <div>
            <p>
              A code has been sent to you by email. Enter that code here, and a
              new password for your account.
            </p>
          </div>
          <div>
            <Textfield
              bind:value={password}
              label="Recovery Code"
              type="text"
            />
          </div>
          <div>
            <Textfield
              bind:value={password}
              label="Password"
              type="password"
              input$autocomplete="new-password"
            />
          </div>
          <div>
            <Textfield
              bind:value={password2}
              label="Re-enter Password"
              type="password"
              input$autocomplete="new-password"
            />
          </div>
          <div class="recover-form-action">
            <a
              href="javascript:void(0);"
              on:click={() => (hasSentSecret = false)}
            >
              Need a New Code?
            </a>
          </div>
        {/if}

        {#if failureMessage}
          <div class="recover-form-failure">
            {failureMessage}
          </div>
        {/if}
      {/if}
    </Content>
    <Actions>
      <Button on:click={() => (showDialog = false)} disabled={recovering}>
        <Label>{successRecoveredMessage ? 'Close' : 'Cancel'}</Label>
      </Button>
      {#if !successRecoveredMessage}
        {#if !hasSentSecret}
          <Button
            on:click$preventDefault$stopPropagation={sendRecovery}
            disabled={recovering}
          >
            <Label>Send Recovery</Label>
          </Button>
        {:else}
          <Button
            on:click$preventDefault$stopPropagation={recover}
            disabled={recovering}
          >
            <Label>Reset Password</Label>
          </Button>
        {/if}
      {/if}
    </Actions>
  </Dialog>
{/if}

<script lang="ts">
  import { onMount, SvelteComponent } from 'svelte';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import FormField from '@smui/form-field';
  import Radio from '@smui/radio';
  import { ClientConfig, User } from '@nymphjs/tilmeld-client';

  // The text used to toggle the dialog.
  export let linkText = "I can't access my account.";
  // Give focus to the account box when the form is ready.
  export let autofocus = true;
  export let recoveryType: 'username' | 'password' = 'password';

  // These are all user provided details.
  export let account = '';
  export let secret = '';
  export let password = '';
  export let password2 = '';

  let clientConfig: ClientConfig | null = null;
  let showDialog = false;
  let recovering = false;
  let hasSentSecret = false;
  let accountElem: SvelteComponent;
  let failureMessage: string | null = null;
  let successRecoveredMessage: string | null = null;

  $: {
    if (showDialog && autofocus && accountElem) {
      accountElem.focus();
    }
  }

  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  function sendRecovery() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        (clientConfig.emailUsernames || recoveryType === 'username'
          ? 'an email address'
          : 'a username') +
        '.';
      return;
    }

    failureMessage = null;
    recovering = true;
    User.sendRecovery({
      recoveryType,
      account,
    }).then(
      (data) => {
        if (!data.result) {
          failureMessage = data.message;
        } else {
          if (recoveryType === 'username') {
            successRecoveredMessage = data.message;
          } else if (recoveryType === 'password') {
            hasSentSecret = true;
          }
        }
        recovering = false;
      },
      () => {
        failureMessage = 'An error occurred.';
        recovering = false;
      }
    );
  }

  function recover() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        (clientConfig.emailUsernames || recoveryType === 'username'
          ? 'an email address'
          : 'a username') +
        '.';
      return;
    }
    if (password !== password2) {
      failureMessage = 'Your passwords do not match.';
      return;
    }
    if (password === '') {
      failureMessage = 'You need to enter a password.';
      return;
    }

    failureMessage = null;
    recovering = true;
    User.recover({
      username: account,
      secret,
      password,
    }).then(
      (data) => {
        if (!data.result) {
          failureMessage = data.message;
        } else {
          successRecoveredMessage = data.message;
        }
        recovering = false;
      },
      () => {
        failureMessage = 'An error occurred.';
        recovering = false;
      }
    );
  }
</script>

<style>
  .recover-form-action {
    margin-top: 1em;
  }
  .recover-form-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
</style>
