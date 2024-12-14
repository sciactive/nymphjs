<svelte:options runes />

{#if $user != null}
  <Dialog
    {use}
    bind:open
    aria-labelledby="tilmeld-password-title"
    aria-describedby="tilmeld-password-content"
    surface$class="tilmeld-password-dialog-surface"
    {...exclude(restProps, [
      'password$',
      'newPassword$',
      'newPassword2$',
      'revokeTokens$',
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
          {...prefixFilter(restProps, 'password$')}
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword}
          label="New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
          {...prefixFilter(restProps, 'newPassword$')}
        />
      </div>

      <div>
        <Textfield
          bind:value={newPassword2}
          label="Re-enter New Password"
          type="password"
          style="width: 100%;"
          input$autocomplete="new-password"
          {...prefixFilter(restProps, 'newPassword2$')}
        />
      </div>

      <div style="margin: 1em 0;">
        <FormField>
          <Checkbox
            bind:checked={revokeCurrentTokens}
            {...prefixFilter(restProps, 'revokeTokens$')}
          />
          {#snippet label()}
            Log out of all other sessions.
            <span
              style="display: block; font-size: 0.7em; height: 0; overflow: visible;"
            >
              Use this if you think you've been hacked.
            </span>
          {/snippet}
        </FormField>
      </div>

      {@render additional?.()}

      {#if failureMessage}
        <div class="tilmeld-password-failure">
          {failureMessage}
        </div>
      {/if}

      {#if loading}
        <div class="tilmeld-password-loading">
          <CircularProgress
            style="height: 24px; width: 24px;"
            indeterminate
            {...prefixFilter(restProps, 'progress$')}
          />
        </div>
      {/if}
    </Content>
    <Actions>
      <Button disabled={loading} {...prefixFilter(restProps, 'closeButton$')}>
        <Label>Close</Label>
      </Button>
      <Button
        onclick={preventDefault(stopPropagation(changePassword))}
        disabled={loading}
        {...prefixFilter(restProps, 'saveButton$')}
      >
        <Label>Change Password</Label>
      </Button>
    </Actions>
  </Dialog>
{/if}

<script lang="ts">
  import type { ComponentProps, Snippet } from 'svelte';
  import { onMount, onDestroy } from 'svelte';
  import type { Writable } from 'svelte/store';
  import { writable } from 'svelte/store';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import Checkbox from '@smui/checkbox';
  import FormField from '@smui/form-field';
  import Button, { Label } from '@smui/button';
  import type { ActionArray } from '@smui/common/internal';
  import { exclude, prefixFilter } from '@smui/common/internal';
  import { preventDefault, stopPropagation } from '@smui/common/events';
  import type { CurrentUserData } from '@nymphjs/tilmeld-client';
  import type { User as UserClass } from '@nymphjs/tilmeld-client';

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
     * User provided. You can bind to it if you need to.
     */
    currentPassword?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    newPassword?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    newPassword2?: string;
    /**
     * User provided. You can bind to it if you need to.
     */
    revokeCurrentTokens?: boolean;

    /**
     * A spot for additional content.
     */
    additional?: Snippet;
  };
  let {
    use = [],
    open = $bindable(false),
    title = 'Change Your Password',
    User,
    user = $bindable(writable(false as unknown as undefined)),
    currentPassword = $bindable(''),
    newPassword = $bindable(''),
    newPassword2 = $bindable(''),
    revokeCurrentTokens = $bindable(false),
    additional,
    ...restProps
  }: OwnProps & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `newPassword\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `newPassword2\$${k}`]?: ComponentProps<typeof Textfield>[k];
  } & {
    [k in keyof ComponentProps<
      typeof Checkbox
    > as `revokeTokens\$${k}`]?: ComponentProps<typeof Checkbox>[k];
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
  } = $props();

  let loading = $state(false);
  let failureMessage: string | undefined = $state();

  $effect(() => {
    if (!open) {
      loading = false;
      failureMessage = undefined;
      currentPassword = '';
      newPassword = '';
      newPassword2 = '';
      revokeCurrentTokens = false;
    }
  });

  const onLogin = (currentUser: UserClass & CurrentUserData) => {
    $user = currentUser;
  };
  const onLogout = () => {
    $user = null;
  };

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    if ($user === (false as unknown as undefined)) {
      $user = undefined;
      $user = await User.current();
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
    loading = true;

    // Get the current user again, in case their data has changed.
    $user = await User.current();

    if ($user == null) {
      failureMessage = 'You must be logged in.';
      loading = false;
      return;
    }

    try {
      // Change the user's password.
      const data = await $user.$changePassword({
        currentPassword,
        newPassword,
        revokeCurrentTokens,
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
