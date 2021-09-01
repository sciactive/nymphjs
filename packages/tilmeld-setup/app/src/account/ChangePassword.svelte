{#if user != null}
  <Dialog
    bind:open
    aria-labelledby="tilmeld-password-title"
    aria-describedby="tilmeld-password-content"
    surface$class="tilmeld-password-dialog-surface"
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-password-title">Change Your Password</Title>
    <Content id="tilmeld-password-content">
      <div>
        <Textfield
          bind:value={currentPassword}
          label="Current Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="current-password"
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword}
          label="New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword2}
          label="Re-enter New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
        />
      </div>

      {#if failureMessage}
        <div class="tilmeld-password-failure">
          {failureMessage}
        </div>
      {/if}

      {#if changing}
        <div class="tilmeld-password-loading">
          <CircularProgress style="height: 24px; width: 24px;" indefinite />
        </div>
      {/if}
    </Content>
    <Actions>
      <Button disabled={changing}>
        <Label>Close</Label>
      </Button>
      <Button
        on:click$preventDefault$stopPropagation={changePassword}
        disabled={changing}
      >
        <Label>Change Password</Label>
      </Button>
    </Actions>
  </Dialog>
{/if}

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import Button, { Label } from '@smui/button';
  import { ClientConfig, CurrentUserData, User } from '@nymphjs/tilmeld-client';

  export let open = false;

  let clientConfig: ClientConfig | null = null;
  let user: (User & CurrentUserData) | null = null;
  let changing = false;
  let failureMessage = null;

  /** User provided. You can bind to it if you need to. */
  export let currentPassword = '';
  /** User provided. You can bind to it if you need to. */
  export let newPassword = '';
  /** User provided. You can bind to it if you need to. */
  export let newPassword2 = '';

  $: {
    if (!open) {
      changing = false;
      failureMessage = null;
      currentPassword = '';
      newPassword = '';
      newPassword2 = '';
    }
  }

  const onLogin = (currentUser: User & CurrentUserData) => {
    user = currentUser;
  };
  const onLogout = () => {
    user = null;
  };

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    user = await User.current();
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

    failureMessage = null;
    changing = true;

    // Get the current user again, in case their data has changed.
    user = await User.current();

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
    } catch (e) {
      failureMessage = e.message;
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
