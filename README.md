# toggl-to-timecard #

Import your Toggl time entries into DelMar Time Card on the command line.

### Install ###

    npm install -g toggl-to-timecard

You will need a Toggl and Time Card account. When you are importing time
entries, you will be prompted for your Toggle API key and Time card credentials.
You can optionally save that data to the Keychain. That said, this only works
on Mac OSX.

Actually, the name of this package is a bit misleading because it also imports
data from Time Card into Toggle so that Toggle entries can be mapped to Time
Card. You will need to do this before you run `toggl-to-timecard` for the first
time.

    timecard-to-toggl

You will be prompted about to which Toggle workspace to import if you have more
than one. If you only have one, it will assume that you want to import it to
that workspace. Note that since `toggl-to-timecard` uses tasks and the billable
flag, you will need a paid workspace subscription.

Here is the mapping:

Time Card  | Toggl
---------- | -------
Client     | Client
Project ID | Project
Task       | Task
Activity   | Tag

Note that if you have a Toggl time entry with multiple tags, it will use
the first one.

It will also warn you about empty descriptions and tags before it attempts to
add any entries to Time Card so all the validation happens before it posts
entries to Time Card.

You're ready to import time entries:

    toggl-to-timecard [start date/time] [end date/time]

If you don't specify a start or end date/time, it will pull data from yesterday (midnight to midnight, local time). If you only specify one date/time, it will pull data from that time to now.

Finally, note that `toggl-to-timecard` will create duplicate entries if you run it for the same date range multiple times. This is a feature I would like to see
but didn't want to dive into dealing with storage for synchronization.
