# Maintaining Documentation

## Rules

1. Mark every system feature **implemented**, **in progress**, or **planned**.
2. Update architecture and CI/CD pages in the same PR as the corresponding code change.
3. Use Mermaid diagrams for component relationships and deployment flows.
4. Keep decisions and their trade-offs visible; do not rewrite history as if every choice was inevitable.
5. Never publish certificates, private keys, AWS tokens, or customer data.

## Suggested ADR pattern

Create `docs/architecture/decisions/0001-title.md`:

```markdown
# ADR 0001: Decision title

- Status: Accepted / Proposed / Superseded
- Context: What problem are we solving?
- Decision: What did we choose?
- Consequences: Trade-offs and follow-up work.
```

## CI validation

Run `mkdocs build --strict` on pull requests to catch broken links and invalid configuration.
