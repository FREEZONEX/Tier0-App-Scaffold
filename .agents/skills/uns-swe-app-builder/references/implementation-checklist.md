# Implementation Checklist

Use this checklist when planning and reviewing a generated application.

## Requirement Analysis

- Identify the application type and intended users.
- Extract required features, workflows, roles, permissions, validations, and state transitions.
- Identify required data models, relationships, and business rules.
- Identify required UI screens, overlay-backed create/edit forms, lists, detail views, dashboards, and operational flows. Treat workspace CRUD forms as `FormDialog` or `Drawer` flows unless the requirements explicitly call for an inline station, filter, scan/manual entry, or review-reason form.
- Classify each frontend workflow by layout intent: station for scan/tap execution, review for evidence/decision queues, workspace for management/planning/analytics, or a custom layout when the built-ins do not fit.
- Identify backend/API requirements, persistence needs, integrations, and error paths.
- Note explicit technology constraints from the requirements or existing project.

## File Organization

- Use a logical project structure appropriate for the selected or existing stack.
- Separate concerns across UI, business logic, data access, utilities, configuration, and tests where applicable.
- Follow conventional naming and directory patterns for the stack.
- Include required configuration files such as `package.json`, framework config, environment examples, or build settings when creating a project from scratch.
- Include setup and usage instructions only when the project format expects them.

## Code Quality Standards

- Generate syntactically valid, complete code.
- Follow language and framework conventions.
- Implement validation and error handling for user input, API calls, and persistence operations.
- Avoid common security issues, including injection-prone data handling, unsafe HTML rendering, hardcoded secrets, and overbroad trust in client input.
- Optimize for maintainability and performance appropriate to the app's scope.
- Keep comments concise and useful.
- Avoid TODO placeholders, mock-only behavior, and disconnected UI for required features.

## Implementation Order

1. Establish project configuration and dependencies.
2. Define data models, schemas, shared types, and domain utilities.
3. Implement backend routes, handlers, services, persistence, and validation.
4. Implement frontend routes, screens, components, overlay-backed create/edit forms, and state flows.
5. Wire frontend to backend or local persistence.
6. Add error, empty, loading, and validation states.
7. Run checks and fix failures.

For this TanStack Start MES scaffold, use the shared service-layer
`bootstrapModule(...)` helper for runtime table/index creation and baseline
seed. Do not hand-roll create/seed sequencing; the helper creates all module
tables/indexes before running any seed callbacks.

## Self-Review

- Check for syntax errors, missing imports, incorrect paths, and unused exports.
- Verify every required workflow is reachable from the UI or API.
- Verify each frontend route uses the layout group that matches the workflow intent.
- Verify forms enforce required fields and validation rules, and that workspace CRUD create/edit forms are launched from buttons, row actions, or empty states into `FormDialog`/`Drawer` instead of being permanently flattened on the page.
- Verify status transitions and business rules match the requirements.
- Verify errors are surfaced to users or callers clearly.
- Verify no required feature is represented only by placeholder text.
- Verify the app starts, builds, or tests successfully using the available environment.
