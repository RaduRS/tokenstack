---
name: tokenstack
description: Load when you need progressive-disclosure code search. Use /ts search <query> to find symbols, then /ts show <id> --level=N to escalate from signature (L1) to skeleton (L2) to full body (L3).
---

# tokenstack search workflow

When you need to find code by concept rather than exact path:

1. `/ts search <query>` — returns ranked hits as `path:lines  [kind] name  (id=...)` (L0)
2. For the most promising hits, `/ts show <id> --level=1` (signature, ~15 tokens)
3. If the signature is not enough, `/ts show <id> --level=2` (skeleton, ~60 tokens)
4. Only if you truly need the body, `/ts show <id> --level=3` (full, ~200+ tokens)

Rule of thumb: never jump straight to L3. Escalate on demand.

Mode control: `/ts status` to see what is active. `/ts mode <off|lite|full|ultra>` to change.

If a Bash command was filtered and you need the raw, note the `recover id=N` in the filtered output and run `/ts recover N`.
