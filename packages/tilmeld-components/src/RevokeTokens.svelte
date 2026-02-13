<svelte:options runes />

{#if $user != null}
  <Dialog
    {use}
    bind:open
    aria-labelledby="tilmeld-revoke-tokens-title"
    aria-describedby="tilmeld-revoke-tokens-content"
    surface$class="tilmeld-revoke-tokens-dialog-surface"
    {...exclude(restProps, [
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
          {...prefixFilter(restProps, 'password$')}
        />
      </div>

      {@render additional?.()}

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
        onclick={preventDefault(stopPropagation(revokeTokens))}
        disabled={loading}
        {...prefixFilter(restProps, 'saveButton$')}
      >
        <Label>Log Out Other Sessions</Label>
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
     * The description of the action given to the user.
     */
    description?: string;
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
    password?: string;

    /**
     * A spot for additional content.
     */
    additional?: Snippet;
  };
  let {
    use = [],
    open = $bindable(false),
    title = 'Log Out of Other Sessions',
    description = 'This will log you out of all other sessions. You can use this if you think your account has been compromised. You will need to log in again on your other devices.',
    User,
    user = $bindable(writable(false as unknown as undefined)),
    password = $bindable(''),
    additional,
    ...restProps
  }: OwnProps & {
    [k in keyof ComponentProps<
      typeof Textfield
    > as `password\$${k}`]?: ComponentProps<typeof Textfield>[k];
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
      password = '';
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

  async function revokeTokens() {
    if (password === '') {
      failureMessage = 'You need to enter your password';
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
      // Revoke the current tokens.
      const data = await $user.$revokeCurrentTokens({
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
