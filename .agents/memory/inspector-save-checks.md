---
name: Inspector save checks
description: Why inspector verification must exercise Save Changes with existing defaults.
---

Verify inspector changes by submitting and checking persisted data, not just by checking that controls display or accept input.

**Why:** Native number-input step validation blocked submission with ordinary loaded defaults, without producing an application error. A visible, editable inspector was not evidence that saving worked.

**How to apply:** When changing inspector fields, submit with default component values and inspect native invalid inputs if Save Changes appears inactive. Ensure minimum values, increments, and defaults align.

Do not require fixed numeric increments for arbitrary imported transforms.
Accept fractional values and let scene validation enforce positive scales;
template pieces include both 0.48 scales and thin details below 0.1.
