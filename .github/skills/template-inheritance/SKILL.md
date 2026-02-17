---
name: template-inheritance
description: Enables rule template inheritance where child templates extend base/system templates with customizable overrides.
---

# Rule Template Inheritance

## Overview

This skill defines how to implement inheritance between rule templates so client-specific
templates can extend base/system templates with controlled customization.

It introduces parent-child template relationships while preserving immutable rule versioning
and deterministic rule evaluation.

---

## When to Use

Use this skill when:

- Adding `parentTemplateId` support to rule template modeling
- Implementing base/system templates with tenant customizations
- Merging inherited parent conditions with child conditions
- Preventing invalid inheritance structures (for example cycles)
- Extending template/version services and validation logic

---

## Key Concepts

- **System Template**: Root template (`isSystem = true`, `parentTemplateId = null`) used as baseline
- **Child Template**: Tenant-specific template that references a parent template
- **Inheritance Chain**: Ordered parent lineage used to resolve effective conditions
- **Effective Condition Tree**: Final merged conditions used when creating a rule version
- **Circular Dependency Guard**: Validation preventing template ancestry loops

---

## Guidelines

- Add `parentTemplateId` (nullable UUID FK) to the rule template model
- Add `isSystem` flag semantics for root/base templates
- Enforce validation: system templates MUST NOT be children
- Enforce validation: inheritance graph MUST be acyclic
- Merge parent and child condition trees deterministically (child extends parent via logical `AND` unless explicit merge policy is defined)
- Keep resulting rule versions immutable after creation
- Surface clear errors for invalid parent references and cycle attempts

### Explicitly Forbidden

- Mutating parent template conditions when customizing child templates
- Duplicating inherited conditions by copy/paste at controller level
- Allowing circular parent relationships
- Evaluating rule versions with unresolved inheritance
- Hiding inheritance behavior in undocumented implicit transformations

---

## Design Rules

- Resolve inheritance in application services before persisting a new rule version
- Keep template metadata and rule version content separate per existing DDD boundaries
- Ensure merged conditions are auditable and traceable to parent/child sources
- Parent changes MUST NOT retroactively modify existing immutable rule versions
- Include organization-aware access controls for parent template usage
- Index parent foreign key fields for efficient chain resolution

---

## Expected Outcome

After applying this skill:

- Base/system templates can be reused safely across tenant customizations
- Child templates produce deterministic merged condition trees
- Rule version immutability is preserved with inheritance support
- The template inheritance challenge requirement is fully implemented
