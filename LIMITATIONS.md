# محدودیت‌ها / Limitations

Verified official documentation on 2026-10-13; these are plan limits, not measured product capacity.

| Resource       | Free limit                                                                                                                     | Product implication                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Workers        | 100,000 requests/day; 10 ms CPU/request; 128 MB/isolate; 50 subrequests/request; six simultaneous outgoing connections/request | Installer pagination, login hashing and long-lived tunnels need field metrics. Memory is shared across requests. |
| D1             | 5 million rows read/day; 100,000 rows written/day; 5 GB account storage; 500 MB per Free database                              | Read/write exhaustion interrupts queries until UTC reset. Index writes also cost rows.                           |
| KV             | 100,000 reads/day; 1,000 writes/deletes/lists per day; 1 GB storage; one write/second to a key                                 | Avoid per-packet accounting and frequent config updates. KV is eventually consistent.                            |
| Workers Builds | 3,000 minutes/month; one concurrent build; 20-minute build timeout                                                             | The maintainer quality/deploy pipeline must fit these limits.                                                    |

Sources: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [KV limits](https://developers.cloudflare.com/kv/platform/limits/), [Builds limits](https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/).

## Transport and quota

The Worker implements direct outbound TCP for VLESS-WS, Trojan-WS and VLESS XHTTP **stream-one**. It does not implement native UDP, WARP/WireGuard transport, packet-up or stream-up. Sing-box/Mihomo output currently contains WS proxy fragments rather than a full routing/DNS application config.

Cloudflare blocks outbound sockets to Cloudflare IP ranges, private/localhost destinations, self loops and port 25. This can prevent access to destinations hosted behind Cloudflare. Do not promise universal TCP reachability. See [official TCP socket restrictions](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/).

Quota accounting checkpoints after 4 MiB of combined payload, 60 seconds on activity, or close. Forwarding now splits payload into at most 64 KiB slices. A conservative application-level allowance is `(4 MiB + 128 KiB) × active metered connections`, covering a slice in flight in each direction, **assuming successful D1 checkpoints and orderly close**. This is not a packet billing guarantee: network bytes already in transit, terminated isolates, failed final writes and changing concurrent-session counts affect accuracy. Idle sessions do not have an independent 60-second timer.

WebSocket pending input is capped at 1 MiB per tunnel; exceeding it closes with code 1009. XHTTP response consumption uses backpressure. Aggregate isolate capacity and WebSocket outbound buffering still need bounded real Cloudflare load tests.

No production CPU claim is made for the 100,000-iteration PBKDF2 login. Local wall-clock measurements cannot prove a Free CPU gate. Backup/restore, chain proxy, clean-IP scanner/registry, advanced client DNS/fragment/ECH and the remaining dashboard pages are unimplemented.

فارسی: اتصال واقعی روی Cloudflare، سهمیه‌ها و سازگاری دستگاه باید جدا از تست محلی تأیید شوند. اگر workers.dev در شبکهٔ کاربر مسدود باشد، حساب رایگان به‌تنهایی دسترسی شبکه را تضمین نمی‌کند. هیچ سرویس پولی به‌طور خودکار فعال نمی‌شود.
