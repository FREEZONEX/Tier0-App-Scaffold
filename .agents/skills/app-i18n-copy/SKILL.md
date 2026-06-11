---
name: app-i18n-copy
description: Normalize product copy and locale behavior for this TanStack Start MES scaffold. Use when the user asks for i18n, localization, translation, language consistency, or to remove mixed Chinese/English UI. Default to one explicit product locale per app or template surface and avoid heavy runtime dictionaries unless the requirements explicitly call for multi-locale switching.
---

# App I18n Copy

## Purpose

Keep generated apps and template surfaces linguistically consistent. In this scaffold, the default goal is not a full runtime i18n framework. The default goal is one clear product locale, consistent visible copy, and no mixed Chinese/English UI in the same finished surface.

## Default Stance

- Choose one explicit product locale for the whole target surface.
- If the user explicitly asks for English, Chinese, or bilingual output, that instruction wins over repo history or conversation language.
- If the user asks for a template-wide or repo-wide language cleanup, apply the chosen locale to runtime UI, touched docs, and touched skills in the same pass.
- Do not infer that this repo should stay Chinese just because earlier revisions used Chinese.
- Do not ship mixed-language labels such as Chinese page content with English buttons, shell labels, pending text, dialog actions, or accessibility labels.
- Do not add a global provider, message catalog, or locale switcher just to normalize one locale.

## Workflow

1. Decide the target locale from the user request first, then product requirements, then existing app copy.
2. Audit all user-visible text before editing:
   - route `<title>` and description
   - login page, Shell, and layout shells
   - sidebar labels, badges, and empty states
   - buttons, dialogs, drawers, toasts, validation, loading, and error text
   - `aria-label`, `title`, tooltip, and icon-button labels
3. If the request is template-wide, also audit touched docs, README text, skill instructions, and visible examples that future agents will copy from.
4. For single-locale apps, keep short copy close to the owning component or shared layout. Small local constants are fine. Do not introduce a runtime dictionary by default.
5. Only introduce an app-local message module when the requirements explicitly need true multi-locale support, runtime language switching, or separate delivered locales.
6. After edits, search again for the opposite locale and for scaffold-default leftovers before finishing.

## This Scaffold

- Use `DESIGN.md` and `$uns-swe-ui-generation` for tone, density, and shell behavior.
- Keep copy operational, short, and domain-specific.
- When converting to English, remove scaffold-default Chinese copy and any mixed Chinese examples from runtime UI, touched docs, and touched skills unless the user explicitly wants bilingual output.
- When converting to Chinese, remove scaffold-default visible English such as `Application`, `Workspace`, `Loading`, `Save`, `Cancel`, `Confirm`, `Back home`, and similar generic placeholders unless the finished product intentionally uses English.
- Make `html lang`, page metadata, overlay defaults, and layout defaults match the chosen locale.
- Keep technical identifiers such as `APP_ID`, API paths, env var names, and TypeScript type names unchanged. Translate human-facing copy, not machine identifiers.

Useful search pattern:

```bash
rg -n 'Application|Workspace|Loading|Save|Cancel|Confirm|Back home|Sign in|Overview|Monitor|Review|Station' src
```

For Chinese text remaining in a repo that should be English:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' '[\p{Han}]' .
```

## Avoid

- Runtime i18n frameworks without an explicit multi-language requirement.
- Mixed Chinese/English product UI in one finished app surface.
- Leaving docs, skill examples, or template starter text in a different language when the user asked for a repo-wide cleanup.
- Leaving accessibility labels or dialog button defaults in a different language from the page.
