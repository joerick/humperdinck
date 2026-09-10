# Project conventions

## Vue template references

- In Vue single-file components, use Vue 3.5's `useTemplateRef()` rather than creating template element references with `ref(null)`.
- The string passed to `useTemplateRef()` must match the static `ref` attribute in the template.
- Prefer the element or component type inferred by Vue Language Tools and `vue-tsc` for static references. When inference is unavailable or the reference is dynamic, supply an explicit generic such as `useTemplateRef<HTMLDetailsElement>('picker')`.
- Template references can be `null` before mount and after conditional unmounting, so access them with optional chaining or an explicit guard.
