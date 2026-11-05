import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

async function start() {
  if (import.meta.env.DEV && import.meta.env.MODE === 'fixture') {
    const { installFixtureControls } = await import('./dev/fixture-controls');
    installFixtureControls();
  }
  createApp(App).use(router).mount('#app');
}

void start();
