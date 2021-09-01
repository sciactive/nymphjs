import { Nymph, Entity } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';
import App from './src/App.svelte';

const app = new App({ target: document.getElementById('app') });

// Helps with admin and debugging.
window.Nymph = Nymph;
window.Entity = Entity;
window.User = User;
window.Group = Group;
window.app = app;
