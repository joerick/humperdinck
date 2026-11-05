import { describe, expect, it, vi } from 'vitest';
import { reactive } from 'vue';
import { createMemoryHistory, createRouter, isNavigationFailure, NavigationFailureType } from 'vue-router';
import { createSettingsNavigation } from '@/settings-navigation';

function fixture() {
  const confirm = vi.fn(() => false);
  const protection = createSettingsNavigation(confirm);
  const state = reactive({ dirty: false, saving: false });
  const unregister = protection.register(state);
  return { confirm, protection, state, unregister };
}

describe('Settings navigation protection', () => {
  it('permits pristine settings and protects edits until they are reverted or discarded', () => {
    const { confirm, protection, state } = fixture();
    expect(protection.canLeave()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    state.dirty = true;
    expect(protection.needsWarning.value).toBe(true);
    expect(protection.canLeave()).toBe(false);
    expect(state.dirty).toBe(true);
    confirm.mockReturnValue(true);
    expect(protection.canLeave()).toBe(true);
    state.dirty = false;
    expect(protection.needsWarning.value).toBe(false);
  });

  it('blocks saves without offering to discard and preserves protection after failure', () => {
    const { confirm, protection, state } = fixture();
    state.dirty = true;
    state.saving = true;
    expect(protection.canLeave()).toBe(false);
    expect(protection.needsWarning.value).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    state.saving = false;
    expect(protection.canLeave()).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
    state.dirty = false;
    expect(protection.canLeave()).toBe(true);
  });

  it('cleans up the active form without removing a newer registration', () => {
    const { protection, state, unregister } = fixture();
    state.dirty = true;
    const removeNew = protection.register({ dirty: true, saving: true });
    unregister();
    expect(protection.saving.value).toBe(true);
    removeNew();
    expect(protection.needsWarning.value).toBe(false);
    expect(protection.canLeave()).toBe(true);
  });

  it('cancels reused-route branch switches and prompts once after repository redirects', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/:repo/:branch/settings', component: { render: () => null } },
        { path: '/:repo/:branch/release', component: { render: () => null } },
        { path: '/other', component: { render: () => null }, beforeEnter: () => '/other/main/release' },
      ],
    });
    await router.push('/first/main/settings');
    const { protection, confirm, state } = fixture();
    router.beforeResolve((to, from) => to.fullPath === from.fullPath || protection.canLeave());
    state.dirty = true;
    const failure = await router.push('/first/next/settings');
    expect(isNavigationFailure(failure, NavigationFailureType.aborted)).toBe(true);
    expect(router.currentRoute.value.path).toBe('/first/main/settings');
    confirm.mockClear();
    await router.push('/other');
    expect(confirm).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.path).toBe('/first/main/settings');
    confirm.mockReturnValue(true);
    await router.push('/other');
    expect(router.currentRoute.value.path).toBe('/other/main/release');
  });
});
