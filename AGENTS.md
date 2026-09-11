# Project conventions

## Vue template references

- In Vue single-file components, use Vue 3.5's `useTemplateRef()` rather than creating template element references with `ref(null)`.
- The string passed to `useTemplateRef()` must match the static `ref` attribute in the template.
- Prefer the element or component type inferred by Vue Language Tools and `vue-tsc` for static references. When inference is unavailable or the reference is dynamic, supply an explicit generic such as `useTemplateRef<HTMLDetailsElement>('picker')`.
- Template references can be `null` before mount and after conditional unmounting, so access them with optional chaining or an explicit guard.

## Class members and Vue reactivity

- Do not use TypeScript `private` members or JavaScript `#private` fields in classes that may pass through Vue reactivity.
- Use an underscore prefix for implementation details instead, for example `_cache`, `_loadManifest()`, or `_waitingCallbacks`.
- Vue may wrap class instances in proxies. Native private fields require the original instance as `this`, while reactive reads and writes to internal state can accidentally become dependencies.
- Mark mutable synchronization primitives such as maps, mutexes, and task registries with `markRaw()` when they must not participate in Vue reactivity.
