import { mount } from 'svelte';
import App from './src/App.svelte';

document.addEventListener('DOMContentLoaded', () => {
  const app = mount(App, {
    target: document.getElementById('app') as HTMLElement,
    props: {},
  });

  // Helps with admin and debugging.
  (window as any).app = app;
});
