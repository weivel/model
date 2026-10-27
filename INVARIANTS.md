# The invariants

What every implementation holds, in every language. The schema says what a manifest may contain;
these say what an implementation does with one. A binding specification renders each of them in its
own language and the conformance suite tests them, so neither restates them.

Each is a property plus the reason it exists, because an author who does not know the reason will
render it away.

1. **A refusal is data, not an exception.** The compatibility check returns a refusal value carrying
   a human-readable detail and fix, or nothing when the artifact is acceptable. It does not throw.
   The marketplace greys an entry with the reason and the kernel refuses at boot with the same
   sentence, both reading one value.
2. **Compatibility is decided in exactly one place**, on two axes in this order: the application the
   artifact targets, then the api floor. One place, because two would eventually disagree about the
   same artifact. **Declaring nothing means "any application"**, so narrowing is always deliberate.
3. **Language never refuses.** A language or implementation declaration selects direct loading or the
   compatibility layer and informs the marketplace. Ruled 2026-09-18 after a draft made a runtime
   mismatch a refusal.
4. **The manifest payload is opaque and preserved by identity.** The engine carries the host's own
   manifest object through uninspected and hands back the same object, not a copy or a re-parse. It
   is the seam that lets one model serve hosts whose manifest types are unrelated.
5. **An unknown manifest field is ignored.** No object closes its property set, so a manifest written
   against a later model loads on today's host. A strict deserializer in a new language inverts this
   by accident, so the suite must test it.
6. **The missing-provider policy is per requirement, never global.** A requirement declared neither
   optional nor degradable refuses when nothing provides it; one declared optional waits. The two
   tiers had opposite global defaults and both were right for their own domain.
7. **Ordering is provider-before-consumer, cycles are returned as data, and the edge source is the
   host's choice**, because a capability implies order on the platform and does not in the client.
8. **Waiting is unbounded by default.** A deferred value may never settle and a timeout is opt-in,
   because "a site that cannot host three replicas today may host them once a node joins". A language
   whose futures must complete, or that cancel on drop, must preserve never-settling without leaking
   the waiter.
9. **A provider's current capacity is re-read, never cached.** An empty answer means "not right now",
   not "never". Caching turns a temporary shortage into a permanent refusal with nothing failing
   visibly.
10. **Registration returns the means to unregister**, and revocation is observable by whoever holds a
    resolved reference. Without this nothing above it can change live.
11. **Per-consumer scoping is contract, not optimisation.** A consumer's view of the registry is
    bound to that consumer, so its registrations and consumptions are attributable and revoking them
    is one operation.
12. **A consumer reaches only the services it declared.** `get`, `want` and `watch` answer for an id
    the plugin lists under `services.consumes` or offers itself under `services.provides`, and for
    nothing else, host services included. Anything else is refused as data under invariant 1: `get`
    returns nothing, `want` is rejected, `watch` is inert, and the host reports the refusal once per
    plugin and id with a fix naming `services.consumes`, so a refusal never reads as absence. A
    declared id that nothing provides is absence, not a refusal, and `ids` lists only what that
    consumer may reach. Without it a manifest's `consumes` is a comment, and the dependency graph a
    host orders and revokes by is not the one its plugins actually use.
