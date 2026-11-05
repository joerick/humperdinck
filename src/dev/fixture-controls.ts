import { createApp } from 'vue';
import FixtureControls from './FixtureControls.vue';
import { fixtureState } from './fixture-auth';

export function installFixtureControls() {
  const nativeConfirm = window.confirm.bind(window);
  window.confirm = message => {
    if (fixtureState.confirmation === 'native') return nativeConfirm(message);
    const allowed = fixtureState.confirmation === 'allow';
    fixtureState.lastAction = `Discard confirmation: ${allowed ? 'allowed' : 'cancelled'}.`;
    return allowed;
  };
  const root = document.createElement('div');
  document.body.append(root);
  createApp(FixtureControls).mount(root);
}
