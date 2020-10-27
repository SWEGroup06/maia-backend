const {DateTime} = require('luxon');

const context = {
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
        res.push([context.combine(start, workDay[i][0]),
          context.combine(start, workDay[i][1])]);
      }
      start = start.plus({days: 1});
      i = (i + 1) % 7;
    }

    return res;
  },
  _schedule: (schedules, duration, constraints = null) => {
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
    if (!schedules || !schedules.length || !duration) return null;
    if (constraints != null) {
      schedules = schedules.concat(constraints);
    }
    let ans = schedules[0];
    schedules.forEach((schedule) => {
      const curr = [];
      let i = 0;
      let j = 0;
      while (i < ans.length && j < schedule.length) {
        const intersection = context.intersection(ans[i], schedule[j], duration);
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
  _choose: (freeTimes) => {
    const choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    choices.sort((a, b) => a[1] - b[1]);
    return choices[0][0];
  },
  /* [
    [start, end]
    .
    .
    .
  ] */
  getFreeSlots: (busySlots, start, end) => {
    // Parse start and end times
    let begin = DateTime.fromISO(start);
    end = DateTime.fromISO(end);

    // Parse busy slots as DateTime objecs
    busySlots = busySlots.map((x) => {
      x[0] = DateTime.fromISO(x[0]);
      x[1] = DateTime.fromISO(x[1]);
      return x;
    });

    // If there are no busy slots return entire time period
    if (!busySlots.length) {
      return [[begin, end]];
    }

    // If start time is within a slot move start time to end of slot
    if (begin > busySlots[0][0] && begin < busySlots[0][1]) {
      begin = busySlots[0][1];
    }

    const freeSlots = [];
    for (let i = 0; i < busySlots.length; i++) {
      const busyTimeSlot = busySlots[i];
      if (busyTimeSlot[1] > end) {
        break;
      }
      if (begin < busyTimeSlot[0]) {
        freeSlots.push([begin, busyTimeSlot[0]]);
        begin = busyTimeSlot[1];
      }
    }
    if (begin < end) {
      freeSlots.push([begin, end]);
    }
    return freeSlots;
  },
  findMeetingSlot(freeTimes, duration, constraints = null) {
    const timeSlots = context._schedule(freeTimes, duration, constraints);
    const choice = context._choose(timeSlots);
    return {start: new Date(choice.ts).toISOString(), end: new Date(choice.plus(duration).ts).toISOString()};
  },
};

module.exports = context;
