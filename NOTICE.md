# Provenance

The provider rate queue was extracted from the owner's Sora2 Videos application
(source revision `4b7a772`, `backend/services/generationQueue.js`) for this public
release. Its positive fractional rate handling and pending-timer process
liveness were corrected. The orchestration, local inspection CLI and tests were
added for the standalone release. The public toolkit subsequently added optional
per-provider concurrency caps with independent rate-budget enforcement, atomic
reconfiguration and regression tests using simulated providers and a mock clock.

No provider keys, original endpoint defaults, accounts, payment logic, customer
jobs, generated media, marketing assets or original Git history are included.
No third-party implementation source is bundled. Node.js and the separately
installed FFmpeg tools retain their own licenses.
