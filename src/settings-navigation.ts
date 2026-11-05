import { computed, inject, shallowRef, type InjectionKey } from 'vue';

interface SettingsState {
  readonly dirty: boolean;
  readonly saving: boolean;
}

export function createSettingsNavigation(confirmDiscard: () => boolean) {
  const active = shallowRef<SettingsState | null>(null);
  const saving = computed(() => active.value?.saving ?? false);
  const needsWarning = computed(() => saving.value || (active.value?.dirty ?? false));

  function canLeave(): boolean {
    if (saving.value) return false;
    return !active.value?.dirty || confirmDiscard();
  }

  function register(state: SettingsState): () => void {
    active.value = state;
    return () => {
      if (active.value === state) active.value = null;
    };
  }

  return { saving, needsWarning, canLeave, register };
}

export const settingsNavigationKey: InjectionKey<ReturnType<typeof createSettingsNavigation>> = Symbol('settingsNavigation');

export function useSettingsNavigation() {
  const navigation = inject(settingsNavigationKey);
  if (!navigation) throw new Error('Settings navigation must be provided by the app');
  return navigation;
}
