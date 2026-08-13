# Why this is Postgres and not MongoDB

The app stores trips, and a trip is a nested thing: a trip has days, a day has
activities. Both kinds of database can hold that. They disagree about where the
shape lives.

## The same trip, both ways

**Postgres, three tables.** A row in `trips`, several in `days`, several more in
`activities`, joined by ids.

```
trips        trip_a1   Kyoto   3 days
days         day_01    trip_a1   0   "Day 1"
activities   act_01    day_01    0   Morning   "Arashiyama Bamboo Grove"
```

**MongoDB, one document.** The whole trip nested inside itself.

```json
{
  "_id": "trip_a1",
  "destination": "Kyoto",
  "days": [
    { "heading": "Day 1",
      "activities": [{ "label": "Morning", "description": "Arashiyama Bamboo Grove" }] }
  ]
}
```

## The trade

The document version is genuinely nicer for the thing this app does most: fetch
one trip and draw it. It is one read, no joins, and the shape that comes back is
already the shape the page wants.

It gets worse at the questions you ask later. "How many trips has each person
generated." "Which destinations come up most." "Which activities mention a place
that has since closed." In SQL those are one query each. In a document store
they are either an aggregation pipeline or a script that reads everything and
counts in memory.

The deeper difference is who enforces the shape. Postgres will refuse to store
an activity whose day does not exist, and will delete the days when the trip
goes, because `ON DELETE cascade` is written into the table. Mongo will happily
store anything, so those rules live in application code, which means they hold
exactly as long as every path through the code remembers them.

## The call

Postgres, because this data has a fixed shape and real relationships, and
because the interesting questions are the relational ones. Neon runs it,
scales to zero when nobody is using it, and costs nothing at this size.

Mongo would be the better answer for data whose shape genuinely varies per
record. A recipe app where one recipe has fermentation steps and another has
none is the classic case. That is not this app: every trip has days, every day
has activities, always.
