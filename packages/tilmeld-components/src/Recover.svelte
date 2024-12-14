<svelte:options runes />

{#if $clientConfig != null && $clientConfig.pwRecovery}
  <Dialog
    {use}
    bind:open
    aria-labelledby="tilmeld-recovery-title"
    aria-describedby="tilmeld-recovery-content"
    surface$class="tilmeld-recover-dialog-surface"
    {...exclude(restProps, [
      'recoveryTypePassword$',
      'recoveryTypeUsername$',
      'account$',
      'alreadyGotCodeLink$',
      'codeSentMessage$',
      'recoveryCode$',
      'password$',
      'password2$',
      'needCodeLink$',
      'sendCodeButton$',
      'resetPasswordButton$',
      'progress$',
    ])}
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-recovery-title">{title}</Title>
    <Content id="tilmeld-recovery-content">
      {#if successRecoveredMessage}
        {successRecoveredMessage}
      {:else}
        {#if !hasSentSecret}
          {#if !$clientConfig.emailUsernames}
            <div>
              <FormField style="margin-right: 1em;">
                <Radio
                  bind:group={recoveryType}
                  value="password"
                  {...prefixFilter(restProps, 'recoveryTypePassword$')}
                />
                {#snippet label()}
                  I don't know my password.
                {/snippet}
              </FormField>
              <FormField style="margin-right: 1em;">
                <Radio
                  bind:group={recoveryType}
                  value="username"
                  {...prefixFilter(restProps, 'recoveryTypeUsername$')}
                />
                {#snippet label()}
                  I don't know my username.
                {/snippet}
              </FormField>
            </div>
          {/if}

          <div>
            {#if recoveryType === 'password'}
              <p>
                To reset your password, type the {$clientConfig.emailUsernames
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
              label={$clientConfig.emailUsernames || recoveryType === 'username'
                ? 'Email Address'
                : 'Username'}
              type={$clientConfig.emailUsernames || recoveryType === 'username'
                ? 'email'
                : 'text'}
              input$autocomplete={$clientConfig.emailUsernames ||
              recoveryType === 'username'
                ? 'email'
                : 'username'}
              input$autocapitalize="off"
              input$spellcheck="false"
              {...prefixFilter(restProps, 'account$')}
            />
          </div>

          {#if recoveryType === 'password'}
            <div class="tilmeld-recover-action">
              <a
                href={'javascript:void(0);'}
                onclick={() => (hasSentSecret = 1)}
                {...prefixFilter(restProps, 'alreadyGotCodeLink$')}
              >
                Already Got a Code?
              </a>
            </div>
          {/if}
        {:else}
          <div>
            <p {...prefixFilter(restProps, 'codeSentMessage$')}>
              A code has been sent to you by email. Enter that code here, and a
              new password for your account.
            </p>
          </div>

          {#if hasSentSecret === 1}
            <div>
              <Textfield
                bind:this={accountElem}
                bind:value={account}
                label={$clientConfig.emailUsernames
                  ? 'Email Address'
                  : 'Username'}
                type={$clientConfig.emailUsernames ? 'email' : 'text'}
                input$autocomplete={$clientConfig.emailUsernames
                  ? 'email'
                  : 'username'}
                input$autocapitalize="off"
                input$spellcheck="false"
                {...prefixFilter(restProps, 'account$')}
              />
            </div>
          {/if}

          <div>
            <Textfield
              bind:value={secret}
              label="Recovery Code"
              type="text"
              input$autocomplete="one-time-code"
              {...prefixFilter(restProps, 'recoveryCode$')}
            />
          </div>

          <div>
            <Textfield
              bind:value={password}
              label="Password"
              type="password"
              input$autocomplete="new-password"
              {...prefixFilter(restProps, 'password$')}
            />
          </div>

          <div>
            <Textfield
              bind:value={password2}
              label="Re-enter Password"
              type="password"
              input$autocomplete="new-password"
              {...prefixFilter(restProps, 'password2$')}
            />
          </div>

          <div class="tilmeld-recover-action">
            <a
              href={'javascript:void(0);'}
              onclick={() => (hasSentSecret = false)}
              {...prefixFilter(restProps, 'needCodeLink$')}
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

        {#if loading}
          <div class="tilmeld-recover-loading">
            <CircularProgress
              style="height: 24px; width: 24px;"
              indeterminate
              {...prefixFilter(restProps, 'progress$')}
            />
          </div>
        {/if}
      {/if}
    </Content>
    <Actions>
      <Button onclick={() => (open = false)} disabled={loading}>
        <Label>{successRecoveredMessage ? 'Close' : 'Cancel'}</Label>
      </Button>
      {#if !successRecoveredMessage}
        {#if !hasSentSecret}
          <Button
            onclick={preventDefault(stopPropagation(sendRecovery))}
            disabled={loading}
            {...prefixFilter(restProps, 'sendCodeButton$')}
          >
            <Label>Send Recovery</Label>
          </Button>
        {:else}
          <Button
            onclick={preventDefault(stopPropagation(recover))}
            disabled={loading}
            {...prefixFilter(restProps, 'resetPasswordButton$')}
          >
            <Label>Reset Password</Label>
          </Button>
        {/if}
      {/if}
    </Actions>
  </Dialog>
{/if}

<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import { onMount } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import FormField from '@smui/form-field';
  import Radio from '@smui/radio';
  import type { ActionArray } from '@smui/common/internal';
  import { exclude, prefixFilter } from '@smui/common/internal';
  import { preventDefault, stopPropagation } from '@smui/common/events';
  import type { SmuiElementPropMap } from '@smui/common';
  import type {
    User as UserClass,
    ClientConfig,
  } from '@nymphjs/tilmeld-client';

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
     * Give focus to the account box when the form is ready.
     */
    autofocus?: boolean;
    /**
     * The type of recovery being requested.
     *
     * User provided. You can bind to it if you need to.
     */
    recoveryType?: 'username' | 'password';
    /**
     * User provided. You can bind to it if you need to.
     */
    account?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    secret?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    password?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    password2?: string;
  };
  let {
    use = [],
    open = $bindable(false),
    title = 'Recover Your Account',
    clientConfig = $bindable(writable(false as unknown as undefined)),
    User,
    autofocus = true,
    recoveryType = $bindable('password'),
    account = $bindable(''),
    secret = $bindable(''),
    password = $bindable(''),
    password2 = $bindable(''),
    ...restProps
  }: OwnProps & {
    [k in keyof ComponentProps<
      typeof Radio
    > as `recoveryTypePassword\$${k}`]?: ComponentProps<typeof Radio>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Radio
    > as `recoveryTypeUsername\$${k}`]?: ComponentProps<typeof Radio>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `account\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `alreadyGotCodeLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof SmuiElementPropMap['p'] as `codeSentMessage\$${k}`]?: SmuiElementPropMap['p'][k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `recoveryCode\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password2\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof SmuiElementPropMap['a'] as `needCodeLink\$${k}`]?: SmuiElementPropMap['a'][k];
  } & {
    [k in keyof ComponentProps<
      typeof CircularProgress
    > as `progress\$${k}`]?: ComponentProps<typeof CircularProgress>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `sendCodeButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } & {
    [k in keyof ComponentProps<
      typeof Button<undefined, 'button'>
    > as `resetPasswordButton\$${k}`]?: ComponentProps<
      typeof Button<undefined, 'button'>
    >[k];
  } = $props();

  let loading = $state(false);
  let hasSentSecret: number | boolean = $state(false);
  let accountElem: Textfield | undefined = $state();
  let failureMessage: string | undefined = $state();
  let successRecoveredMessage: string | undefined = $state();

  $effect(() => {
    if (open && autofocus && accountElem) {
      accountElem.focus();
    }
  });

  onMount(async () => {
    if ($clientConfig === (false as unknown as undefined)) {
      $clientConfig = undefined;
      $clientConfig = await User.getClientConfig();
    }
  });

  async function sendRecovery() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        ($clientConfig?.emailUsernames || recoveryType === 'username'
          ? 'an email address'
          : 'a username') +
        '.';
      return;
    }

    failureMessage = undefined;
    loading = true;

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
    loading = false;
  }

  async function recover() {
    if (account === '') {
      failureMessage =
        'You need to enter ' +
        ($clientConfig?.emailUsernames || recoveryType === 'username'
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
    loading = true;
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
    loading = false;
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
