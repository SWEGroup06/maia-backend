const { DateTime, Duration } = require('luxon');

const s = {
  intersection: (slot1, slot2, duration) => {
    let new_slot = [DateTime.max(slot1[0], slot2[0]),
                    DateTime.min(slot1[1], slot2[1])];
    return new_slot[0].plus(duration) <= new_slot[1] ? new_slot : null;
  },
  combine: (date, time) => {
    return DateTime.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute
    });
  },
  generate_constraints: (work_day, start, end) => {
    // minus 1 as [monday -> 1 .. sunday -> 7]
    let i = start.weekday - 1;
    let res = [];

    while (start <= end) {
      if (work_day[i].length == 2) {
        res.push([s.combine(start, work_day[i][0]),
                  s.combine(start, work_day[i][1])]);
      }
      start = start.plus({days: 1});
      i = (i + 1) % 7;
    }

    return res;
  },
  busy_to_free: (schedule, start, end) => {
    let begin = start;
    let curr_free_times = [];
    for (let i = 0; i < schedule.length; i++){
      const busy_time = schedule[i];
      if (busy_time[1] > end) {
        break;
      }
      if (begin < busy_time[0]) {
        curr_free_times.push([begin, busy_time[0]]);
        begin = busy_time[1];
      }
    }
    if (begin < end) {
      curr_free_times.push([begin, end]);
    }
    return curr_free_times;
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
      schedules = schedules.concat(constraints);
    }
    let ans = schedules[0];
    schedules.forEach(schedule => {
      const curr = [];
      let i = 0;
      let j = 0;
      while (i < ans.length && j < schedule.length) {
        let intersection = s.intersection(ans[i], schedule[j], duration);
        if (intersection != null) {
          curr.push(intersection);
        }
        // increment pointer for free list item that ends first, keeps the other the same
        if (ans[i][1] < schedule[j][1]) {
          i++;
        } else {
          j++;
        }
      }
      ans = curr
    });

    // return list of possible starting time slot intervals
    return ans.map(xs => [xs[0], xs[1].minus(duration)])
  },
  choose: (free_times) => {
    choices = free_times.map(xs => [xs[0], xs[1].diff(xs[0])]);
    choices.sort((a, b) => a[1] - b[1]);
    return choices[0][0];
  }
};

module.exports = s;

