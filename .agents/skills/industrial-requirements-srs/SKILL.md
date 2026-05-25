---
name: industrial-requirements-srs
description: Create and save implementation-ready software requirements specifications for industrial operations and manufacturing systems. Use when the user asks to generate, normalize, convert, revise, or save a spec/SRS from an app spec, PRD, feature brief, requirements text, factory, shopfloor, MES, MOM, QMS, WMS, ISA-95, ISA-88, material, production, warehouse, quality, traceability, consumption, defect, inventory, or manufacturing workflow need; also use when saving the result as specs/spec.md by default, or when clarification questions are needed before drafting.
---

# Industrial Requirements SRS

## Purpose

Transform vague or concrete industrial software requests into bounded, operationally executable requirements specifications. Support three stable scenarios: creating an SRS from an initial request, converting an existing PRD or requirements draft into the required SRS format, and revising an existing SRS after the user adds or changes requirements. Produce documents that are suitable as the preferred source input for `$uns-swe-app-builder`, while keeping the SRS itself technology-neutral. Focus on factory workflows, business logic, exchanged data, roles, validations, and user interactions.

## Workflow

1. Classify the request as one of these scenarios: new SRS generation, PRD-to-SRS conversion, or existing SRS revision.
2. Determine whether the operational scope and requested change are sufficiently clear.
3. If clarification is needed, ask concise clarification questions before drafting.
4. If the scope is clear, read `references/spec-template.md` before drafting or revising the SRS. Do not draft from memory.
5. Use the available file write/edit tool to save the complete SRS as Markdown.
6. Default output path is `specs/spec.md` relative to the current workspace or user-specified output directory; create `specs/` if it does not exist.
7. When revising an existing SRS, update the target `spec.md` with the complete revised document, not a partial patch.
8. When the user intends to build an app afterward, make the SRS implementation-ready enough for `$uns-swe-app-builder` to consume without requiring raw PRD context.
9. If an `unsswe_notify_card` MCP tool is available, call it exactly once after the completed SRS file is saved and make that call the final action.

## Scenario Rules

Treat source documents titled "Spec", "App Spec", "PRD", "Feature Brief", "Requirements", or similar as source material. Convert them into the required SRS template instead of preserving their original structure.

### New SRS Generation

- Use the user's request as the source of scope, roles, workflows, data, validation rules, and UI flows.
- Ask clarification questions only when the requested operational scope is too vague, broad, or ambiguous to produce an implementation-ready SRS.
- Do not invent unrelated modules or platform capabilities to make the document look complete.

### PRD-to-SRS Conversion

- Treat the provided PRD, requirements draft, notes, or pasted source material as the source of truth.
- Preserve stated business facts, operational rules, terms, roles, constraints, and workflow intent.
- Convert the source material into the required SRS structure from `references/spec-template.md`; do not preserve the PRD's original section structure unless it matches the template.
- Fill obvious structural gaps only when directly inferable from the source material and industrial context.
- Ask clarification questions when missing information blocks an implementation-ready SRS, especially missing scope boundaries, direct operator roles, workflow triggers, validation rules, or required outputs.
- Do not silently add business rules that are not stated or strongly implied.

### Existing SRS Revision

- Treat the existing SRS as the current baseline and the user's new instruction as a change request.
- Save a complete revised SRS document, not a partial patch or diff.
- Preserve the required structure, existing IDs, naming style, and unaffected content where still valid.
- Update all impacted sections consistently, including roles, permissions, user stories, data models, business logic, UI flows, and validation rules.
- Add new IDs sequentially when new roles, stories, models, workflows, or screens are needed.
- Remove or rewrite obsolete content only when the user's change clearly supersedes it.
- Ask clarification questions only when the requested change cannot be applied without choosing between materially different business meanings.

## Scope Rules

- Define the scope as a module, subsystem, bounded industrial application, or related multi-module scope according to the user's request.
- Do not force a valid multi-domain request into a single object or module.
- Do not expand beyond the expressed business need.
- State an explicit, bounded app or module name in the document.
- Keep all content business-logic focused: input, processing, output, roles, validations, and operational workflow.
- Avoid platform-level, architecture, scalability, future extensibility, and technology-stack claims unless the user explicitly requests them.
- Never use generic roles such as "User", "Viewer", "Read-only", or "Business User".

## Clarification Decision

Generate the SRS when the requested operational scope is sufficiently clear, including bounded multi-domain requests.

Stop and ask clarification questions only when:

- The request is too vague or broad to identify an operational workflow.
- The scope boundary could reasonably mean different applications or execution contexts.
- The actor groups, operational concerns, or intended workflow are unclear.

When clarification is needed:

- Ask only the questions needed to unblock an implementation-ready SRS.
- Prefer concrete options when the user needs to choose between meaningful application boundaries or workflow choices.
- Free-text questions are allowed when a constrained option set would distort the business meaning.
- Keep questions concise and avoid drafting the SRS in the same response.

## File Output

Before generating any SRS document, read `references/spec-template.md` and follow its required structure and section constraints.

When the SRS can be generated, save it to a Markdown file:

- Default path: `specs/spec.md`.
- If the user specifies a path, use that path instead.
- Create the parent directory if it does not exist.
- Write the complete requirements document body only; do not wrap file contents in `=====doc:start=====` or `=====doc:end=====` markers.
- Do not split the SRS across multiple files unless the user explicitly asks.
- After saving, respond with a concise confirmation and the saved path unless a required final MCP card call must be the last action.

File content rules:

- Do not wrap the document body in a markdown code block.
- Never place clarification questions inside the saved SRS file.
- Do not save a partial document.
- Do not include assistant commentary in the saved file.

## Builder Handoff

The completed SRS file is the recommended input for `$uns-swe-app-builder`.

- Preserve operational details that affect implementation: roles, permissions, user stories, data fields, business logic, UI flows, validation rules, and system outputs.
- Avoid technology-stack choices in the SRS; let the Builder infer stack from the target project or user instruction.
- If the user asks to build next, suggest using `specs/spec.md` as the Builder input.
- Do not require the user to build immediately.

## Requirements Card

If an `unsswe_notify_card` MCP tool is available, call it exactly once after every completed requirements document file is saved. Make the card call the final action of the response and do not output assistant text afterward.

For the first completed draft, call:

```json
{
  "card_type": "requirements_doc_ready",
  "data": {
    "card_id": "requirements_v1",
    "status": "idle",
    "hint": "The requirements document is complete and ready for confirmation."
  }
}
```

For revised completed drafts after a previous requirements card exists:

- First update the old card with the same `card_id` and `status: "ignored"`.
- Then output the new full document.
- Then call a new card with the next versioned `card_id` and `status: "idle"`.

Use only these statuses:

- `idle`: current completed draft waits for user confirmation.
- `ignored`: older card superseded by a newer draft.
- `confirmed`: use only after explicit user confirmation.

If the tool is unavailable, still follow all file output rules and do not invent a substitute tool call.
