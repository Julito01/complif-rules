---
name: transaction-model-alignment
description: Aligns the Part 1 transaction model with the challenge PDF fields using minimal, backward-compatible changes.
---

# Transaction Model Alignment

## Overview

Use this skill to close the challenge gap where the transaction model is missing
fields required by the PDF.

Goal: add missing fields with minimal disruption and keep evaluation deterministic.

---

## When to Use

Use this skill when:

- Adding missing transaction columns/entities in Part 1
- Extending DTOs for transaction ingestion
- Updating persistence and mapping logic for compliance evaluations
- Verifying field parity against challenge requirements

---

## Required Fields Checklist

Ensure the model supports these fields (in addition to existing ones):

- `sub_type`
- `quantity`
- `asset`
- `price`
- `is_voided`
- `is_blocked`
- `is_deleted`
- `external_code`
- `data` (JSON/JSONB)
- `origin`
- `device_info` (JSON/JSONB)
- `date` (separate from datetime)
- `id_transaction_lote`
- `last_updated_by` (or equivalent canonical field)

Keep naming strategy consistent with the existing project conventions.

---

## Implementation Rules

- Prefer additive, backward-compatible changes
- Keep defaults safe (`false` for booleans, nullable where optional)
- Do not break current ingest endpoints
- Keep multi-tenant constraints (`idOrganization`) intact
- Preserve current evaluation behavior unless explicitly required

---

## Validation Scope

- DTO validation for all newly exposed fields
- Correct persistence mapping in entity + service
- Existing tests must keep passing
- Add targeted tests for newly mapped fields

---

## Anti-Patterns

Avoid:

- Renaming existing stable API fields without migration strategy
- Coupling transaction schema directly to one specific rule template
- Adding business logic side effects during field-mapping changes

---

## Expected Outcome

After applying this skill:

- Transaction payload coverage matches the challenge model
- Existing flows remain stable
- New fields are available for future rule types (geo/behavior/lists)
