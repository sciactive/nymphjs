<section>
  <h2 style="margin-top: 0;">Tilmeld Introduction</h2>

  <p>
    Welcome to Tilmeld. This program handles users and groups. It can be a
    little tricky to set up, so read through this introduction carefully. You
    can familiarize yourself with the search box's syntax <a
      href="https://nymph.io/packages/query-parser/"
      target="_blank"
      rel="noreferrer noopener">here</a
    >.
  </p>

  <h3>How It Works</h3>
  <p>
    Tilmeld uses Nymph entities to store users and groups. It allows users to
    register and log in using the Nymph REST endpoint.
  </p>

  <h3>Users</h3>
  <p>
    User accounts can be created either in this setup app or by registering
    through the <code>$register</code> functions in both the client side and
    server-side entities. The first user account registered in Tilmeld will be
    granted admin priveleges with the <code>system/admin</code> ability.
  </p>
  <p>
    If you create a user account through this setup app, it will not have a
    generated primary group, so you may want to avoid that.
  </p>

  <h3>Primary Groups</h3>
  <p>
    Users can have only one primary group. It becomes the group of any entities
    they create. By default, Tilmeld will create a new primary group for every
    user.
  </p>

  <h3>Secondary Groups</h3>
  <p>
    Secondary groups are used to grant users additional abilities or give access
    to entities.
  </p>

  <h3>Access Controls</h3>
  <p>
    Tilmeld filters all calls to Nymph to allow users to only see and modify the
    entities they have access to. When a user creates an entity, their user
    becomes the <code>user</code> property of that entity, and their primary
    group becomes the <code>group</code> property. By default, entites will allow
    read/write/delete access to their user, read access to their group, and no access
    to other users.
  </p>
  <p>
    In addition to the <code>user</code> and <code>group</code> properties,
    there are also <code>acFull</code>, <code>acWrite</code>, and
    <code>acRead</code> properties on entities that can grant other users permission
    to the entity.
  </p>

  <h3>Abilities</h3>
  <p>
    Abilities can be granted to users and/or their groups. When you call
    <code>$gatekeeper</code>, it will check for the given ability.
  </p>

  <h3>Generated Primary Groups</h3>
  <p>
    Tilmeld, by default, is configured to generate a primary group for every new
    user with the same groupname as their username and the same name. When the
    user is changed, that information is propagated to the group.
  </p>
</section>

<script lang="ts">
  let {}: {} = $props();
</script>
