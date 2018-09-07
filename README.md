# toggl-to-jira

### Install

    yarn global add https://github.com/heymagurany/toggl-to-jira.git
    
### Usage

`toggl-to-jira` only supports the `epic` command at the moment.

#### Epic Command

Aggregate Jira issue work logs for issues and sub-issues under an epic.

    toggl-to-jira epic -f 2018-02-01 -t 2018-03-01 -w 19

Option            |Description
------------------|-----------
--help            |Show help
--from-time, -f   |The date/time from which to search for work logs, inclusve. ex. `2018-04-01T04:00:00.000Z`
--to-time, -t     |The date/time to which to search for work logs,non-inclusve. ex. `2018-05-01T03:59:59.999Z`
--working-days, -w|The number of days to include in the calculation.

The output is a JSON encoded map of epics to time spent

    {
        "(none)": {
            "timeSpentSeconds": 960,
            "timeSpentPercent": 1
        },
        "PURE-2060": {
            "timeSpentSeconds": 245460,
            "timeSpentPercent": 45
        }
    }
