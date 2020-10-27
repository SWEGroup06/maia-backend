const {DateTime, Duration} = require('luxon');

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
    let begin = DateTime.fromISO(start);
    // console.log(schedule);
    end = DateTime.fromISO(end);
    schedule = schedule.map((x) => {
      x[0] = DateTime.fromISO(x[0]);
      x[1] = DateTime.fromISO(x[1]);
      console.log(x[0].hour, x[1].hour);
      return x;
    });
    const currFreeTimes = [];
    if (begin > schedule[0][0] && begin < schedule[0][1]) {
      begin = schedule[0][1];
    }
    for (let i = 0; i < schedule.length; i++) {
      const busyTimeSlot = schedule[i];
      if (busyTimeSlot[1] > end) {
        break;
      }
      if (begin < busyTimeSlot[0]) {
        currFreeTimes.push([begin, busyTimeSlot[0]]);
        begin = busyTimeSlot[1];
      }
    }
    if (begin < end) {
      currFreeTimes.push([begin, end]);
    }
    console.log(currFreeTimes);
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
  busyTimeFrequencies: (lastMonthBusySchedule) => {
    const halfHoursInDay = 48;
    const days = 7;
    const frequencies = Array(days).fill(Array(halfHoursInDay).fill(0));
    for (const timeSlot of lastMonthBusySchedule) {
      const begin = DateTime.fromISO(timeSlot[0]);
      const end = DateTime.fromISO(timeSlot[1]);
      const startHour = begin.hour;
      const startHalf = begin.minute >= 30 ? 1 : 0;
      const halfHour = Duration.fromObject({minutes: 30});
      let i = startHour*2 + startHalf;
      while (begin < end) {
        const day = begin.day;
        frequencies[day][i]++;
        i = (i+1) % halfHoursInDay;
        begin.plus(halfHour);
      }
    }
  },
};

module.exports = s;
