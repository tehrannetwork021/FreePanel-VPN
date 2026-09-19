# Contributing / راهنمای مشارکت

## فارسی

قبل از شروع، `README.md`، `SECURITY.md` و `AGENTS.md` را بخوانید. `AGENTS.md` دفتر وضعیت پروژه است؛ کاری را فقط زمانی `[x]` کنید که تست مرتبط واقعاً سبز شده باشد.

برای تغییرات رفتاری از TDD استفاده کنید: ابتدا تستی بنویسید که به دلیل نبود قابلیت شکست بخورد، سپس حداقل کد لازم را اضافه کنید و کل Suite را اجرا کنید.

لطفاً در Issue، PR، Log یا Screenshot هیچ Cloudflare API Token، UUID، Subscription Secret، Session Cookie یا Proxy credential قرار ندهید.

## English

Read `README.md`, `SECURITY.md`, and `AGENTS.md` before making changes. `AGENTS.md` is the project ledger; mark an item `[x]` only after its verification actually passes.

Use test-first development for behavioral changes: write a test that fails for the missing behavior, implement the smallest change, then run the full suite.

Never include Cloudflare tokens, UUIDs, subscription secrets, session cookies, or proxy credentials in issues, pull requests, logs, or screenshots.

## Required checks

```bash
pnpm check
pnpm test:e2e
```

Keep modules focused, preserve Persian/English parity, and avoid introducing third-party code until its license has been reviewed.
