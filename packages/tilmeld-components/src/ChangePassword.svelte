{#if user != null}
  <Dialog
    use={usePass}
    bind:open
    aria-labelledby="tilmeld-password-title"
    aria-describedby="tilmeld-password-content"
    surface$class="tilmeld-password-dialog-surface"
    {...exclude($$restProps, [
      'password$',
      'newPassword$',
      'newPassword2$',
      'closeButton$',
      'saveButton$',
      'progress$',
    ])}
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-password-title">{title}</Title>
    <Content id="tilmeld-password-content">
      <div>
        <Textfield
          bind:value={currentPassword}
          label="Current Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="current-password"
          {...prefixFilter($$restProps, 'password$')}
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword}
          label="New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
          {...prefixFilter($$restProps, 'newPassword$')}
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword2}
          label="Re-enter New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
          {...prefixFilter($$restProps, 'newPassword2$')}
        />
      </div>

      <slot name="additional" />

      {#if failureMessage}
        <div class="tilmeld-password-failure">
          {failureMessage}
        </div>
      {/if}

      {#if changing}
        <div class="tilmeld-password-loading">
          <CircularProgress
            style="height: 24px; width: 24px;"
            indeterminate
            {...prefixFilter($$restProps, 'progress$')}
          />
        </div>
      {/if}
    </Content>
    <Actions>
      <Button
        disabled={changing}
        {...prefixFilter($$restProps, 'closeButton$')}
      >
        <Label>Close</Label>
      </Button>
      <Button
        on:click$preventDefault$stopPropagation={changePassword}
        disabled={changing}
        {...prefixFilter($$restProps, 'saveButton$')}
      >
        <Label>Change Password</Label>
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
  import { User } from '@nymphjs/tilmeld-client';

  const forwardEvents = forwardEventsBuilder(get_current_component());

  export let use: ActionArray = [];
  $: usePass = [forwardEvents, ...use] as ActionArray;
  export let open = false;
  export let title = 'Change Your Password';
  export let user: (User & CurrentUserData) | undefined = undefined;

  let changing = false;
  let failureMessage: string | undefined = undefined;

  /** User provided. You can bind to it if you need to. */
  export let currentPassword = '';
  /** User provided. You can bind to it if you need to. */
  export let newPassword = '';
  /** User provided. You can bind to it if you need to. */
  export let newPassword2 = '';

  $: {
    if (!open) {
      changing = false;
      failureMessage = undefined;
      currentPassword = '';
      newPassword = '';
      newPassword2 = '';
    }
  }

  const onLogin = (currentUser: User & CurrentUserData) => {
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

  async function changePassword() {
    if (currentPassword === '') {
      failureMessage = 'You need to enter your current password';
      return;
    }
    if (newPassword !== newPassword2) {
      failureMessage = 'Your passwords do not match.';
      return;
    }
    if (newPassword === '') {
      failureMessage = 'You need to enter a new password';
      return;
    }

    failureMessage = undefined;
    changing = true;

    // Get the current user again, in case their data has changed.
    user = (await User.current()) ?? undefined;

    if (user == null) {
      failureMessage = 'You must be logged in.';
      changing = false;
      return;
    }

    try {
      // Change the user's password.
      const data = await user.$changePassword({
        currentPassword,
        newPassword,
      });

      if (!data.result) {
        failureMessage = data.message;
      } else {
        open = false;
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    changing = false;
  }
</script>

<style>
  :global(.mdc-dialog .mdc-dialog__surface.tilmeld-password-dialog-surface) {
    width: 360px;
    max-width: calc(100vw - 32px);
  }
  .tilmeld-password-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
  .tilmeld-password-loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
