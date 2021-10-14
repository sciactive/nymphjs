{#if clientConfig != null && user != null}
  <Dialog
    bind:open
    aria-labelledby="tilmeld-account-title"
    aria-describedby="tilmeld-account-content"
    surface$class="tilmeld-account-dialog-surface"
  >
    <!-- Title cannot contain leading whitespace due to mdc-typography-baseline-top() -->
    <Title id="tilmeld-account-title">Your Account</Title>
    <Content id="tilmeld-account-content">
      {#if !clientConfig.emailUsernames && clientConfig.allowUsernameChange}
        <div>
          <Textfield
            bind:value={user.username}
            label="Username"
            type="text"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={usernameVerified === false}
            input$autocomplete="username"
            input$autocapitalize="off"
            input$spellcheck="false"
          >
            <HelperText persistent slot="helper">
              {usernameVerifiedMessage || ''}
            </HelperText>
          </Textfield>
        </div>
      {/if}

      {#if clientConfig.emailUsernames || clientConfig.userFields.indexOf('email') !== -1}
        <div>
          <Textfield
            bind:value={user.email}
            label="Email"
            type="email"
            style="width: 100%;"
            helperLine$style="width: 100%;"
            invalid={emailVerified === false}
            input$autocomplete="email"
            input$autocapitalize="off"
            input$spellcheck="false"
          >
            <HelperText persistent slot="helper">
              {emailVerifiedMessage || ''}
            </HelperText>
          </Textfield>
        </div>
      {/if}

      {#if clientConfig.userFields.indexOf('name') !== -1}
        <div>
          <Textfield
            bind:value={user.nameFirst}
            label="First Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="given-name"
          />
        </div>

        <div>
          <Textfield
            bind:value={user.nameMiddle}
            label="Middle Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="additional-name"
          />
        </div>

        <div>
          <Textfield
            bind:value={user.nameLast}
            label="Last Name"
            type="text"
            style="width: 100%;"
            input$autocomplete="family-name"
          />
        </div>
      {/if}

      {#if clientConfig.userFields.indexOf('phone') !== -1}
        <div>
          <Textfield
            bind:value={user.phone}
            label="Phone Number"
            type="tel"
            style="width: 100%;"
            input$autocomplete="tel"
            input$name="phone"
          />
        </div>
      {/if}

      <div class="tilmeld-account-action">
        <a
          href="javascript:void(0);"
          on:click={() => {
            open = false;
            changePasswordOpen = true;
          }}
        >
          Change your password.
        </a>
      </div>

      {#if failureMessage}
        <div class="tilmeld-account-failure">
          {failureMessage}
        </div>
      {/if}

      {#if saving}
        <div class="tilmeld-account-loading">
          <CircularProgress style="height: 24px; width: 24px;" indeterminate />
        </div>
      {/if}
    </Content>
    <Actions>
      <Button disabled={saving}>
        <Label>Close</Label>
      </Button>
      <Button on:click$preventDefault$stopPropagation={save} disabled={saving}>
        <Label>Save Changes</Label>
      </Button>
    </Actions>
  </Dialog>
  <ChangePassword bind:open={changePasswordOpen} />
{/if}

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CircularProgress from '@smui/circular-progress';
  import Dialog, { Title, Content, Actions } from '@smui/dialog';
  import Textfield from '@smui/textfield';
  import HelperText from '@smui/textfield/helper-text/index.js';
  import Button, { Label } from '@smui/button';
  import { ClientConfig, CurrentUserData, User } from '@nymphjs/tilmeld-client';
  import ChangePassword from './ChangePassword.svelte';

  export let open = false;

  let clientConfig: ClientConfig | undefined = undefined;
  let user: (User & CurrentUserData) | undefined = undefined;
  let saving = false;
  let originalUsername: string | undefined = undefined;
  let originalEmail: string | undefined = undefined;
  let failureMessage: string | undefined = undefined;
  let usernameTimer: NodeJS.Timeout | undefined = undefined;
  let usernameVerified: boolean | undefined = undefined;
  let usernameVerifiedMessage: string | undefined = undefined;
  let emailTimer: NodeJS.Timeout | undefined = undefined;
  let emailVerified: boolean | undefined = undefined;
  let emailVerifiedMessage: string | undefined = undefined;
  let changePasswordOpen = false;

  const onLogin = (currentUser: User & CurrentUserData) => {
    user = currentUser;
    readyEntity();
    originalUsername = user?.username;
    originalEmail = user?.email;
  };
  const onLogout = () => {
    user = undefined;
    originalUsername = undefined;
    originalEmail = undefined;
  };

  $: if (user && user.username !== originalUsername) {
    checkUsername();
  } else {
    if (usernameTimer) {
      clearTimeout(usernameTimer);
    }
    usernameVerified = true;
    usernameVerifiedMessage = undefined;
  }

  $: if (user && user.email !== originalEmail) {
    checkEmail();
  } else {
    if (emailTimer) {
      clearTimeout(emailTimer);
    }
    emailVerified = true;
    emailVerifiedMessage = undefined;
  }

  onMount(async () => {
    User.on('login', onLogin);
    User.on('logout', onLogout);
    user = (await User.current()) ?? undefined;
    readyEntity();
    originalUsername = user?.username;
    originalEmail = user?.email;
  });
  onMount(async () => {
    clientConfig = await User.getClientConfig();
  });

  onDestroy(() => {
    User.off('login', onLogin);
    User.off('logout', onLogout);
  });

  function readyEntity() {
    // Make sure all fields are defined.
    if (user != null && user.username == null) {
      user.username = '';
    }
    if (user != null && user.email == null) {
      user.email = '';
    }
    if (user != null && user.nameFirst == null) {
      user.nameFirst = '';
    }
    if (user != null && user.nameMiddle == null) {
      user.nameMiddle = '';
    }
    if (user != null && user.nameLast == null) {
      user.nameLast = '';
    }
    if (user != null && user.avatar == null) {
      user.avatar = '';
    }
    if (user != null && user.phone == null) {
      user.phone = '';
    }
  }

  async function save() {
    if (user == null) {
      return;
    }

    failureMessage = undefined;
    saving = true;

    if (clientConfig?.emailUsernames) {
      user.username = user.email;
    }

    try {
      if (await user.$save()) {
        readyEntity();
        originalEmail = user.email;
        open = false;
        usernameVerifiedMessage = undefined;
        emailVerifiedMessage = undefined;
      } else {
        failureMessage = 'Error saving account changes.';
      }
    } catch (e: any) {
      failureMessage = e?.message;
    }
    saving = false;
  }

  function checkUsername() {
    usernameVerified = undefined;
    usernameVerifiedMessage = undefined;
    if (usernameTimer) {
      clearTimeout(usernameTimer);
      usernameTimer = undefined;
    }
    usernameTimer = setTimeout(async () => {
      try {
        const data = await user?.$checkUsername();
        usernameVerified = data?.result ?? false;
        usernameVerifiedMessage =
          data?.message ?? 'Error getting verification.';
      } catch (e: any) {
        usernameVerified = false;
        usernameVerifiedMessage = e?.message;
      }
    }, 400);
  }

  function checkEmail() {
    emailVerified = undefined;
    emailVerifiedMessage = undefined;
    if (emailTimer) {
      clearTimeout(emailTimer);
      emailTimer = undefined;
    }
    emailTimer = setTimeout(async () => {
      try {
        const data = await user?.$checkEmail();
        emailVerified = data?.result ?? false;
        emailVerifiedMessage = data?.message ?? 'Error getting verification.';
      } catch (e: any) {
        emailVerified = false;
        emailVerifiedMessage = e?.message;
      }
    }, 400);
  }
</script>

<style>
  :global(.mdc-dialog .mdc-dialog__surface.tilmeld-account-dialog-surface) {
    width: 360px;
    max-width: calc(100vw - 32px);
  }
  .tilmeld-account-failure {
    margin-top: 1em;
    color: var(--mdc-theme-error, #f00);
  }
  .tilmeld-account-action {
    margin-top: 1em;
  }
  .tilmeld-account-loading {
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
