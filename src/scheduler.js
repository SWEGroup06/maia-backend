const {DateTime, Duration} = require('luxon');

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

  /**
   * Generate constraints [monday -> 0 .. sunday -> 6]
   * @param { Array } weekConstraints [{startTime: ISO String, endTime: ISO String}]
   * @param { string } _start ISO Date/Time format, represents start DateTime that event can occur
   * @param { string } _end ISO Date/Time format, represents end DateTime
   * @return { Array } [[ dateTime, dateTime ], ...]
   */
  generateConstraints: (weekConstraints, _start, _end) => {
    if (weekConstraints == null) {
      return [];
    }
    let start = DateTime.fromISO(_start);
    const end = DateTime.fromISO(_end);
    let i = start.weekday - 1;
    const res = [];
    while (start <= end) {
      if (weekConstraints[i].startTime !== '' && weekConstraints[i].endTime !== '') {
        res.push([context.combine(start, DateTime.fromISO(weekConstraints[i].startTime)),
          context.combine(start, DateTime.min(DateTime.fromISO(weekConstraints[i].endTime), end))]);
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
    if (choices.length === 0) {
      return null;
    }
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
    if (!freeTimes || freeTimes.length === 0) {
      return;
    }
    const timeSlots = context._schedule(freeTimes, duration, constraints);
    const choice = context._choose(timeSlots);
    if (choice) {
      return {
        start: new Date(choice.ts).toISOString(),
        end: new Date(choice.plus(duration).ts).toISOString(),
      };
    }
    return null;
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
      let i = startHour * 2 + startHalf;
      while (begin < end) {
        const day = begin.day;
        frequencies[day][i]++;
        i = (i + 1) % halfHoursInDay;
        begin.plus(halfHour);
      }
    }
  },
};

module.exports = context;
