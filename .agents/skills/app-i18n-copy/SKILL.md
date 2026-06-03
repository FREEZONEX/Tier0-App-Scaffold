---
name: app-i18n-copy
description: Normalize product copy and locale behavior for this TanStack Start MES scaffold. Use when the user asks for i18n, localization, translation, language consistency, or to remove mixed Chinese/English UI. Default to one explicit product locale per app and avoid heavy runtime dictionaries unless the requirements explicitly call for multi-locale switching.
---

# App I18n Copy

## Purpose

Keep generated apps linguistically consistent. In this scaffold, the default goal is not a full runtime i18n framework. The default goal is a single clear product locale, consistent visible copy, and no mixed Chinese/English UI.

## Default Stance

- Choose one product locale for the whole app surface.
- If the user or requirements do not specify otherwise, follow the dominant locale in the conversation. In this repo that usually means Simplified Chinese.
- Do not ship mixed-language labels such as Chinese page content with English buttons, shell labels, pending text, or dialog actions.
- Do not add a global provider, message catalog, or locale switcher just to normalize one locale.

## Workflow

1. Decide the target locale from the user request, product requirements, and existing app copy.
2. Audit all user-visible text before editing:
   - route `<title>` and description
   - login page, Shell, and layout shells
   - sidebar labels, badges, and empty states
   - buttons, dialogs, drawers, toasts, validation, loading, and error text
   - `aria-label`, `title`, tooltip, and icon-button labels
3. For single-locale apps, keep short copy close to the owning component or shared layout. Small local constants are fine. Do not introduce a runtime dictionary by default.
4. Only introduce an app-local message module when the requirements explicitly need true multi-locale support, runtime language switching, or separate delivered locales.
5. After edits, search again for scaffold-default mixed copy before finishing.

## This Scaffold

- Use `DESIGN.md` and `$uns-swe-ui-generation` for tone, density, and shell behavior.
- Keep copy operational, short, and domain-specific.
- Remove scaffold-default visible English such as `Application`, `Workspace`, `Loading`, `Save`, `Cancel`, `Confirm`, `Back home`, and similar generic placeholders unless the finished product intentionally uses English.
- Make `html lang`, page metadata, overlay defaults, and layout defaults match the chosen locale.

Useful search pattern:

```bash
rg -n 'Application|Workspace|Loading|Save|Cancel|Confirm|Back home|Sign in|Overview|Monitor|Review|Station' src
```

## Avoid

- Runtime i18n frameworks without an explicit multi-language requirement.
- Mixed Chinese/English product UI in one finished app surface.
- Leaving accessibility labels or dialog button defaults in a different language from the page.
