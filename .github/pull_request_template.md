## Summary

What changed and why. One paragraph, no file lists.

## Checks

- [ ] `pnpm verify` passes
- [ ] No secrets, tokens, or `.env` files are included in the diff
- [ ] New environment variables are added to `.env.example` **and** are read
      somewhere in the code
- [ ] Any new number on screen is derived, not typed in
- [ ] Any visual change is followed by `pnpm capture`

## Notes

Anything a reviewer should know: a change to the billing model, a dependency
that moved a major version, a test that was adjusted rather than fixed, or work
left deliberately undone.
