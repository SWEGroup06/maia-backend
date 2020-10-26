const {DateTime} = require('luxon');

const s = {
  intersection: (slot1, slot2, duration) => {
    const newSlot = [DateTime.max(slot1[0], slot2[0]),
      DateTime.min(slot1[1], slot2[1])];
    return newSlot[0].plus(duration) <= newSlot[1] ? newSlot : null;
  },
  combine: (date, time) => {
    return DateTime.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
      hour: time.hour,
      minute: time.minute,
    });
  },
  generateConstraints: (workDay, start, end) => {
    // work_day is a list containing the start and end time of a single work day
    // start is the start datetime that event can occur
    // end is the end datetime
    // minus 1 as [monday -> 1 .. sunday -> 7]
    let i = start.weekday - 1;
    const res = [];

    while (start <= end) {
      if (workDay[i].length === 2) {
        res.push([s.combine(start, workDay[i][0]),
          s.combine(start, workDay[i][1])]);
      }
      start = start.plus({days: 1});
      i = (i + 1) % 7;
    }

    return res;
  },
  busyToFree: (schedule, start, end) => {
    let begin = start;
    const currFreeTimes = [];
    for (let i = 0; i < schedule.length; i++) {
      const busyTime = schedule[i];
      if (busyTime[1] > end) {
        break;
      }
      if (begin < busyTime[0]) {
        currFreeTimes.push([begin, busyTime[0]]);
        begin = busyTime[1];
      }
    }
    if (begin < end) {
      currFreeTimes.push([begin, end]);
    }
    return currFreeTimes;
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
    schedules.forEach((schedule) => {
      const curr = [];
      let i = 0;
      let j = 0;
      while (i < ans.length && j < schedule.length) {
        const intersection = s.intersection(ans[i], schedule[j], duration);
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
      ans = curr;
    });

    // return list of possible starting time slot intervals
    return ans.map((xs) => [xs[0], xs[1].minus(duration)]);
  },
  choose: (freeTimes) => {
    const choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    choices.sort((a, b) => a[1] - b[1]);
    return choices[0][0];
  },
};

module.exports = s;
