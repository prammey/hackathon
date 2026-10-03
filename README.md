# Prism

Prism is a browser extension that makes confusing websites calm, readable and easy to use, without
breaking them. It tidies the page you're on, explains anything you point at, helps fill in forms, and
can carry out a task step by step, always asking before anything important.

**Status:** Phase 1 (specifications, feasibility, access) complete — waiting for go-ahead to build.

## Specifications
| File | Contents |
| --- | --- |
| [specs/01-product.md](specs/01-product.md) | Goals, personas, user journeys, acceptance criteria |
| [specs/02-architecture.md](specs/02-architecture.md) | Architecture, browsers, permissions, AI integration, data flows |
| [specs/03-design-system.md](specs/03-design-system.md) | Prism brand + the four Styles (tokens) |
| [specs/04-page-transformation.md](specs/04-page-transformation.md) | Tidy, restore, dynamic pages, caching |
| [specs/05-selection-and-assistance.md](specs/05-selection-and-assistance.md) | Point at something, Define, Translate, Fill out, Chat, workflows |
| [specs/06-personalization.md](specs/06-personalization.md) | About you, imports, data handling, settings |
| [specs/07-milestones-and-verification.md](specs/07-milestones-and-verification.md) | Milestones and browser verification plan |
| [specs/08-access-and-feasibility.md](specs/08-access-and-feasibility.md) | Access checklist, assumptions, limits, open questions |

Progress and acceptance tracking: [PROGRESS.md](PROGRESS.md). Phase 1 evidence: `evidence/phase1/`.

## Tools
- `python3 scripts/contrast_check.py` — checks every Style colour pair against WCAG contrast minimums.
