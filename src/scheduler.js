const { DateTime, Duration } = require('luxon');

const s = {
  intersection: (range1, range2, duration) => {
    let new_range = [DateTime.max(range1[0], range2[0]),
      DateTime.min(range1[1], range2[1])];
    return new_range[0].plus(duration) <= new_range[1] ? new_range : null
  },
  combine: (date, time) => {
    return DateTime.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute
    })
  },
  generate_constraints: (work_day, start, end) => {
    let i = start.weekday; // sunday -> 0, monday -> 1 ...etc.
    let res = [];
    while (start !== end) {
      if (work_day[i].length >= 2) {
        res.push([s.combine(start, work_day[i][0]),
          s.combine(start, work_day[i][1])])
      }
      start = start.plus({days: 1});
      i = (i + 1) % 7;
    }
    if (work_day[i].length >= 2) {
      res.push([s.combine(start, work_day[i][0]),
        s.combine(start, work_day[i][1])])
    }
    return res
  },
  busy_to_free: (schedule, start, end) => {
    let begin = start;
    let curr_free_times = [];
    for (let i = 0; i < schedule.length; i++){
      const busy_time = schedule[i];
      if (busy_time.end > end) {
        break;
      }
      if (begin < busy_time.start) {
        curr_free_times.push([begin, busy_time.start]);
        begin = busy_time.end
      }
    }
    if (begin < end) {
      curr_free_times.push([begin, end])
    }
    return curr_free_times
  },
  schedule: (schedules, duration, constraints = null) => {
    /*
    schedules is a list of (start_free_datetime, end_free_datetime)
    pre-conditions:
    schedules contains all times between possible start datetime and end datetime
    of meeting
    :param schedules: list containing everyone's free schedules
    :param duration: duration of event to be booked
    :return: ranges for all possible start date times of the event (gives range of every
    possible time event could start at)
    */
    if (constraints != null) {
      schedules.concat(constraints)
    }
    let ans = schedules[0];
    schedules.forEach(schedule => {
      const temp = [];
      let i = 0;
      let j = 0;
      while (i < ans.length && j < schedule.length) {
        let intersection = s.intersection(ans[i], schedule[j], duration);
        if (intersection != null) {
          temp.push(intersection);
        }
        // increment pointer for free list item that ends first, keeps the other the same
        (ans[i][1] < schedule[j][1]) ? i++ : j++;
      }
      ans = temp
    });
    /* convert list of free time slots to list of ranges of start date times
    * e.g for duration = 1hr, ans = [((2020, 10, 14, 9), (2020, 10, 14, 11))] ->
    * [((2020, 10, 14, 9), (2020, 10, 14, 10))]
    * since can start anytime between 9am and 10am for a 1hr meeting */
    ans = ans.map(xs => {
      xs[1] = xs[1].minus(duration);
      return xs
    });
    return ans
  }
};

module.exports = s;

