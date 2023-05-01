{#if user != null}
  <Dialog
    use={usePass}
    bind:open
    aria-labelledby="tilmeld-revoke-tokens-title"
    aria-describedby="tilmeld-revoke-tokens-content"
    surface$class="tilmeld-revoke-tokens-dialog-surface"
    {...exclude($$restProps, [
      'password$',
      'closeButton$',
      'saveButton$',
      'progress$',
    ])}
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-revoke-tokens-title">{title}</Title>
    <Content id="tilmeld-revoke-tokens-content">
      <div>
        {description}
      </div>

      <div style="margin-top: 1em;">
        <Textfield
          bind:value={password}
          label="Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="current-password"
          {...prefixFilter($$restProps, 'password$')}
        />
      </div>

      <slot name="additional" />

      {#if failureMessage}
        <div class="tilmeld-revoke-tokens-failure">
          {failureMessage}
        </div>
      {/if}

      {#if loading}
        <div class="tilmeld-revoke-tokens-loading">
          <CircularProgress
            style="height: 24px; width: 24px;"
            indeterminate
            {...prefixFilter($$restProps, 'progress$')}
          />
        </div>
      {/if}
    </Content>
    <Actions>
      <Button disabled={loading} {...prefixFilter($$restProps, 'closeButton$')}>
        <Label>Close</Label>
      </Button>
      <Button
        on:click$preventDefault$stopPropagation={revokeTokens}
        disabled={loading}
        {...prefixFilter($$restProps, 'saveButton$')}
      >
        <Label>Log Out Other Sessions</Label>
      </Button>
    </Actions>
  </Dialog>
{/if}

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get_current_component } from 'svelte/internal';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import type { ActionArray } from '@smui/common/internal';
  import {
    forwardEventsBuilder,
    exclude,
    prefixFilter,
  } from '@smui/common/internal';
  import type { CurrentUserData } from '@nymphjs/tilmeld-client';
  import type { User as UserClass } from '@nymphjs/tilmeld-client';

  const forwardEvents = forwardEventsBuilder(get_current_component());

  export let use: ActionArray = [];
  $: usePass = [forwardEvents, ...use] as ActionArray;
  export let open = false;
  export let title = 'Log Out of Other Sessions';
  export let description =
    'This will log you out of all other sessions. You can use this if you think your account has been compromised. You will need to log in again on your other devices.';
  export let User: typeof UserClass;
  export let user: (UserClass & CurrentUserData) | undefined = undefined;

  let loading = false;
  let failureMessage: string | undefined = undefined;

  /** User provided. You can bind to it if you need to. */
  export let password = '';

  $: if (!open) {
    loading = false;
    failureMessage = undefined;
    password = '';
  }

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    user = currentUser;
  };
  const onLogout = () => {
    user = undefined;
  };

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    if (user === undefined) {
      user = (await User.current()) ?? undefined;
    }
  });

  onDestroy(() => {
    User.off('login', onLogin);
    User.off('logout', onLogout);
  });

  async function revokeTokens() {
    if (password === '') {
      failureMessage = 'You need to enter your password';
      return;
    }

    failureMessage = undefined;
    loading = true;

    // Get the current user again, in case their data has changed.
    user = (await User.current()) ?? undefined;

    if (user == null) {
      failureMessage = 'You must be logged in.';
      loading = false;
      return;
    }

    try {
      // Revoke the current tokens.
      const data = await user.$revokeCurrentTokens({
        password,
      });

      if (!data.result) {
        failureMessage = data.message;
      } else {
        open = false;
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    loading = false;
  }
</script>

<style>
  :global(
      .mdc-dialog .mdc-dialog__surface.tilmeld-revoke-tokens-dialog-surface
    ) {
    width: 360px;
    max-width: calc(100vw - 32px);
  }
  .tilmeld-revoke-tokens-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
  .tilmeld-revoke-tokens-loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
