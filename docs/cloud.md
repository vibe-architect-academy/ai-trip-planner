# Cloud as lego bricks

## The decision is smaller than it looks

What this app actually needs from a cloud provider is four things:

- a machine that runs containers
- a Postgres somebody else operates
- somewhere to put files
- a way to point a domain at it

Every provider sells all four. They disagree about the names, the console and
the bill, and almost not at all about what the parts do, so learning one
teaches you most of the next.

The course uses Oracle Cloud for the self-hosting chapters for one unglamorous
reason: its free tier includes ARM instances genuinely large enough to run
this, indefinitely, for nothing. AWS and Google Cloud do the same job with far
more services and an actual invoice.

## What the platform was doing for you

Worth reading before deciding to leave, because this is the real bill:

- running several instances and routing between them
- serving static assets from machines near the visitor
- TLS certificates, issued and renewed before they expire
- zero-downtime deploys, and a way back when one is bad
- a preview environment per branch

None of it is hard. All of it is work, and it is work that continues forever
rather than being done once.

## The test

If you cannot name which of those five you would take over, and who does it on
the Tuesday you are ill, you are not ready to move off the platform yet. That
is not a criticism. It is the entire reason platforms exist.
