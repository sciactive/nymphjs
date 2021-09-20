{#if clientConfig != null && clientConfig.pwRecovery}
  <Dialog
    bind:open
    aria-labelledby="tilmeld-recovery-title"
    aria-describedby="tilmeld-recovery-content"
    surface$class="tilmeld-recover-dialog-surface"
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-recovery-title">Recover Your Account</Title>
    <Content id="tilmeld-recovery-content">
      {#if successRecoveredMessage}
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
              input$autocomplete={clientConfig.emailUsernames ||
              recoveryType === 'username'
                ? 'email'
                : 'username'}
              input$autocapitalize="off"
              input$spellcheck="false"
            />
          </div>

          {#if recoveryType === 'password'}
            <div class="tilmeld-recover-action">
              <a
                href="javascript:void(0);"
                on:click={() => (hasSentSecret = 1)}
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

          {#if hasSentSecret === 1}
            <div>
              <Textfield
                bind:this={accountElem}
                bind:value={account}
                label={clientConfig.emailUsernames
                  ? 'Email Address'
                  : 'Username'}
                type={clientConfig.emailUsernames ? 'email' : 'text'}
                input$autocomplete={clientConfig.emailUsernames
                  ? 'email'
                  : 'username'}
                input$autocapitalize="off"
                input$spellcheck="false"
              />
            </div>
          {/if}

          <div>
            <Textfield
              bind:value={secret}
              label="Recovery Code"
              type="text"
              input$autocomplete="one-time-code"
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

          <div class="tilmeld-recover-action">
            <a
              href="javascript:void(0);"
              on:click={() => (hasSentSecret = false)}
            >
              Need a New Code?
            </a>
          </div>
        {/if}

        {#if failureMessage}
          <div class="tilmeld-recover-failure">
            {failureMessage}
          </div>
        {/if}

        {#if recovering}
          <div class="tilmeld-recover-loading">
            <CircularProgress
              style="height: 24px; width: 24px;"
              indeterminate
            />
          </div>
        {/if}
      {/if}
    </Content>
    <Actions>
      <Button on:click={() => (open = false)} disabled={recovering}>
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
  import { onMount } from 'svelte';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield, { TextfieldComponentDev } from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import FormField from '@smui/form-field';
  import Radio from '@smui/radio';
  import { ClientConfig, User } from '@nymphjs/tilmeld-client';

  export let open = false;
  // Give focus to the account box when the form is ready.
  export let autofocus = true;
  export let recoveryType: 'username' | 'password' = 'password';

  /** User provided. You can bind to it if you need to. */
  export let account = '';
  /** User provided. You can bind to it if you need to. */
  export let secret = '';
  /** User provided. You can bind to it if you need to. */
  export let password = '';
  /** User provided. You can bind to it if you need to. */
  export let password2 = '';

  let clientConfig: ClientConfig | undefined = undefined;
  let recovering = false;
  let hasSentSecret: number | boolean = false;
  let accountElem: TextfieldComponentDev;
  let failureMessage: string | undefined = undefined;
  let successRecoveredMessage: string | undefined = undefined;

  $: {
    if (open && autofocus && accountElem) {
      accountElem.focus();
    }
  }

  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  async function sendRecovery() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        (clientConfig?.emailUsernames || recoveryType === 'username'
          ? 'an email address'
          : 'a username') +
        '.';
      return;
    }

    failureMessage = undefined;
    recovering = true;

    try {
      const data = await User.sendRecovery({
        recoveryType,
        account,
      });
      if (!data.result) {
        failureMessage = data.message;
      } else {
        if (recoveryType === 'username') {
          successRecoveredMessage = data.message;
        } else if (recoveryType === 'password') {
          hasSentSecret = true;
        }
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    recovering = false;
  }

  async function recover() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        (clientConfig?.emailUsernames || recoveryType === 'username'
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

    failureMessage = undefined;
    recovering = true;
    try {
      const data = await User.recover({
        username: account,
        secret,
        password,
      });
      if (!data.result) {
        failureMessage = data.message;
      } else {
        successRecoveredMessage = data.message;
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    recovering = false;
  }
</script>

<style>
  :global(.mdc-dialog .mdc-dialog__surface.tilmeld-recover-dialog-surface) {
    width: 540px;
    max-width: calc(100vw - 32px);
  }
  .tilmeld-recover-action {
    margin-top: 1em;
  }
  .tilmeld-recover-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
  .tilmeld-recover-loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
