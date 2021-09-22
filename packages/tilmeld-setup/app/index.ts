import App from './src/App.svelte';

const app = new App({ target: document.getElementById('app') as HTMLElement });

// Helps with admin and debugging.
(window as any).app = app;
