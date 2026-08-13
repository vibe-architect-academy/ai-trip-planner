# Running this somewhere other than Vercel

The live app runs on Vercel, which handles all of the below without being
asked. These files exist because the job does not disappear when a platform
hides it, and because the day you outgrow the platform is a bad day to meet
these ideas for the first time.

## Load balancing

`deploy/nginx.conf` runs three copies of the app behind nginx.

Two details in there are worth more than the rest of the file:

**`proxy_buffering off`.** Nginx buffers responses by default, which would
hold a streaming itinerary until it was complete and quietly undo lesson 10.
This is the most common way streaming stops working behind a proxy, and it
fails silently: nothing errors, the app just feels slow again.

**Timeouts longer than the app's own.** If the proxy gives up before the
function does, the user gets a 504 for work that was about to succeed.

## Picking between instances

`least_conn`, not round robin. Requests here are wildly uneven: a seven day
itinerary occupies a worker for most of a minute while a page load takes
milliseconds. Round robin would keep handing new work to the instance already
busy with the slow one.

## Where the cloud comes in

Once there is more than one instance, something has to own the machines they
run on. That is the next lesson.
