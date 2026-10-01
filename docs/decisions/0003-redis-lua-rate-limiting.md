# 0003. One atomic Lua script on Redis

*One window per tenant, however many instances serve it.*

## Context

A token bucket in a `ConcurrentHashMap` is local to its process. Behind a
load balancer with N replicas every tenant gets N times its limit, because
each JVM counts on its own. Giving the bucket a distributed backend makes
the library a wrapper around the same Redis operations, with its own
round trips.

## Decision

Each tenant's window is a Redis sorted set: a member per request, scored by
time. One Lua script reads Redis's clock (`TIME`), evicts entries older than
the window, counts what is left, admits the request if there is room and
sets the key's expiry. Redis runs a script without interleaving, so the
read-modify-write is indivisible: no lock, no `WATCH`/`MULTI`/`EXEC`, no
race between instances. The time comes from Redis, so instances whose
clocks drift apart still share one window.

```lua
local time = redis.call('TIME')
local now  = time[1] * 1000 + math.floor(time[2] / 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)
local count = redis.call('ZCARD', key)
if count < limit then
    redis.call('ZADD', key, now, jti)
    redis.call('PEXPIRE', key, window)        -- an idle tenant's key cleans itself
end
return {allowed, count, oldest, now}          -- what the headers report, read in the same step
```

Every tenant response carries `RateLimit-Limit`, `RateLimit-Remaining` and
`RateLimit-Reset`; a `429` adds `Retry-After`.

When Redis cannot be reached within two seconds, the request is refused
with `503` and `Retry-After`. Without the limiter there is no knowing
whether the tenant is within its budget, and the fault is the server's, so
it is not a `429`.

## Consequences

- Every tenant request asks Redis first, and the limit fails closed while
  Redis is away.
- The window is exact, not approximated by fixed buckets, at the cost of a
  member per request in the window.
