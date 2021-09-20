import { Nymph, Entity } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';
import App from './src/App.svelte';

const app = new App({ target: document.getElementById('app') as HTMLElement });

// Helps with admin and debugging.
(window as any).Nymph = Nymph;
(window as any).Entity = Entity;
(window as any).User = User;
(window as any).Group = Group;
(window as any).app = app;
