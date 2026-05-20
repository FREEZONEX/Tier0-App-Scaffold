# Industrial SRS Spec Template

Use this template when generating an implementation-ready industrial software requirements specification.

## Required Document Structure

Use this structure exactly, adapting headings in brackets to the requested scope.

Structural constraints:

- Do not add, remove, rename, or reorder top-level sections.
- For repeated models, workflows, and screens, continue numeric headings sequentially: `3.2`, `3.3`, `4.2`, `4.3`, `5.2`, `5.3`.
- Keep all subsection labels exactly as shown, including `Purpose`, `Key Elements`, `User Interaction Flow`, and `Validation Rules`.
- Do not add extra sections such as Assumptions, Out of Scope, Non-functional Requirements, Architecture, API, Database, or Future Enhancements unless the user explicitly requests them.
- Do not add API Requirements, Seed Requirements, Build Requirements, Verification Requirements, database tool names, framework names, package commands, or implementation-stack sections unless the user explicitly requests implementation constraints in the SRS.
- Use the table column names exactly as shown.
- Save only the requirements document body in the final `spec.md`; do not include response markers or assistant commentary in the file.

```markdown
# 1. Overview

## 1.1 Description

- App name: <bounded scope name>
- Project goals and objectives:

# 2. Requirements

## 2.1 Roles and Permission

| Role ID | Display Name | Description | Permission |
|---|---|---|---|

## 2.2 User Story

| US ID | As a | I want to | So that |
|---|---|---|---|

# 3. Data Models

## 3.1 <Model Name A>

- Description:

| Field Name | Definition | Notes |
|---|---|---|

# 4. Business Logic

## 4.1 <Workflow Name A>

- Related user story: <US IDs>
- Trigger:
- Logic:
- Output:

# 5. UI

## 5.1 <Screen Name A>

- Purpose:
- Key Elements:
- User Interaction Flow:
- Validation Rules:
```

## Section Rules

### 1. Overview

- Name the app, module, subsystem, or bounded industrial application according to the user's actual requested scope.
- State goals as operational outcomes, not platform or technology goals.
- Keep the scope explicit and bounded.

### 2.1 Roles and Permission

- Always include `root | Root | Full Access`.
- Use `root` only for application development; never use it in user stories.
- Derive every non-root role from concrete actions in section 2.2.
- Include only direct in-module operators.
- Exclude stakeholders who only consume, approve, reference, or reuse data outside the module.
- Map each non-root role to at least one user story.
- Remove any role that has no direct in-module action.
- Prefer 2 to 4 non-root roles unless the requested scope clearly needs more.
- Describe permissions as operational capabilities, not CRUD labels.
- Use wording like "Can record defect" instead of technical CRUD levels.
- Prefer ISA-95 style role names such as Process Engineer, Production Supervisor, Quality Inspector, Warehouse Operator, Material Handler, Maintenance Technician, or Line Leader.
- Never use generic roles such as "User", "Viewer", "Read-only", or "Business User".

### 2.2 User Story

- Break scenarios into concise operational user stories.
- Keep each story to a maximum of 3 lines.
- Avoid fluff and generic value statements.
- Do not create user stories for `root`.
- Ensure every user story uses a role that appears in section 2.1.

### 3. Data Models

- Define only business-critical fields.
- Describe business meaning, not implementation schema details.
- Include identifiers, status fields, operational quantities, timestamps, references, and validation-relevant values when needed.
- Avoid technology-specific schema language unless the user explicitly requests it.

### 4. Business Logic

- Describe the operational workflows implemented by the system.
- Describe how the system processes inputs and produces outputs.
- Reference related user stories by ID.
- State the trigger for each workflow.
- Use numbered steps under `Logic`.
- Include rejection, validation, exception, and status-transition rules when they affect operations.
- Use mermaid only when it materially clarifies a workflow; mermaid code blocks are allowed inside the document block.

### 5. UI

- Describe how users interact with the system to complete tasks.
- Focus on interaction flows rather than UI components.
- Describe user actions and system responses.
- Ensure flows are consistent with business scenarios.
- Include validation rules such as required fields, range limits, deviation thresholds, duplicate checks, and status restrictions.
- Do not describe UI at component level unless needed for business clarity.

## Quality Bar

- Prefer specific operational rules over generic statements.
- Keep generated content operationally executable, business-logic focused, and implementation-ready.
- Do not include vague future extensibility sections.
- Do not include unnecessary scalable architecture claims.
- Do not include platform-level capabilities unless the user explicitly asks for a platform.
- Do not assume React, SQL, Cloud, or any other implementation technology.
- Focus exclusively on business logic: input, processing, output.

Bad:

```text
The system should be flexible enough to handle various quality checks.
```

Good:

```text
System must reject any Weight input that deviates more than 5% from Target_Weight defined in the work order.
```
