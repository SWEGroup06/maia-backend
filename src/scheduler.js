const {DateTime, Duration} = require('luxon');

/* CONSTANTS */
const halfHoursInDay = 24 * 2;
const days = 7;
const halfHour = Duration.fromObject({minutes: 30});

const context = {
  /**
   * Internal function that takes two datetime objects and returns their interection, if that
   * intersectoin is of a minimum size
   * @param { datetime } slot1
   * @param { datetime } slot2
   * @param { duration } duration minimum size of interction is given by duration
   * @return { datetime } intersection of slot1 and slot2 or null
   */
  intersection: (slot1, slot2, duration) => {
    const newSlot = [DateTime.max(slot1[0], slot2[0]),
                     DateTime.min(slot1[1], slot2[1])];
    return newSlot[0].plus(duration) <= newSlot[1] ? newSlot : null;
  },
  /**
   * Internal function that takes two objects, one for date info and one for time info, and returns
   * a datetime based on it
   * @param { Object } date object with year, month and day fields
   * @param { Object } time object with hour and minute fields
   * @return { datetime }
   */
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
   * Takes in days of the week to produce availablities for, indicated by weekdayAvailable array. The
   * available times are passed in the availableTimes array. The function will produce availablities
   * for a number of weeks, specified by the weeks parameter
   * @param { Array } weekdayAvailable array of boolean flags
   * @param { Array } availableTimes [{startTime
   * : x, endtime: y}], where startTime
   *  < endtime
   * @param { Int } weeks number of weeks to produce availablity for
   * @return { Array } [[ dateTime, dateTime ], ...],
   */
  generateConstraints: (weekdayAvailable, availableTimes, weeks=1) => {
    // bad input
    if (!weekdayAvailable ||
      !availableTimes ||
      !availableTimes.length ||
      weeks < 1) {
      return null;
    }

    let date = DateTime.fromISO(availableTimes[0].startTime);
    let weekday = date.weekday - 1;
    availableTimes = availableTimes.map((x) => {
      const z = DateTime.fromISO(x.startTime);
      const y = DateTime.fromISO(x.endTime);
      return {'start': z, 'end': y};
    });
    const res = [];
    for (let days = 0; days < weeks * 7; days++) {
      // generate available times for only days of the weekday that are specified
      if (weekdayAvailable[weekday]) {
        for (const time of availableTimes) {
          res.push([context.combine(date, time.start.c), context.combine(date, time.end.c)]);
        }
      }
      // increment to the next day
      weekday = (weekday + 1) % 7;
      date = date.plus({days: 1});
    }

    return res;
  },
  /**
   * Takes in a team's schedules, the duration of the event and any other constraints, and will
   * return all possible times that the event can take place.
   * @param { Array } schedules array of array of array of 2 datetimes [[[startTime
   * , endtime], ...]]
   * @param { Duration } duration duration of the event
   * @param { Array } constraints array of array of two datetimes, [[startTime
   * , endtime]]
   * @return { Array } array of array of two datetimes, [[startTime
   * , endtime]]
   */
  _schedule: (schedules, duration, constraints = null) => {
    // bad input
    if (!schedules
      || !schedules.length
      || !duration) return null;

    // include availability constraints
    if (constraints != null) schedules = schedules.concat(constraints);

    let ans = schedules[0];
    schedules.forEach((schedule) => {
      const curr = [];
      let i = 0, j = 0;
      while (i < ans.length && j < schedule.length) {
        // find intersection
        const intersection = context.intersection(ans[i], schedule[j], duration);
        if (intersection != null) {
          curr.push(intersection);
        }
        // increment pointer for item that ends first
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
  /**
   * Chooses a time period, preferencing time slots which are smaller
   * @param { Array } freeTimes times that event could be scheduled
   * @return { datetime } chosen time for the event
   */
  _choose: (freeTimes) => {
    const choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    choices.sort((a, b) => a[1] - b[1]);
    if (choices.length === 0) {
      return null;
    }
    return choices[0][0];
  },
  getTimeSlotValue: (begin, end, historyFreq) => {
    let val = 0;
    const startHour = begin.hour;
    const startHalf = begin.minute >= 30 ? 1 : 0;
    let i = startHour * 2 + startHalf;
    while (begin < end) {
      const day = begin.weekday - 1;
      val += historyFreq[day][i] ** 2;
      i = (i + 1) % halfHoursInDay;
      begin = begin.plus(halfHour);
    }
    return val;
  },
  /**
   * chooses the best time slot out of list of free times considering the user's history of most
   * common busy times
   * @param {Array} freeTimes -- array returned by _schedule [[start1, start2]]
   * @param {Array} historyFreq -- array returned by userHistory()
   * @param {Duration} duration -- event's duration
   * @param {Boolean} isClustered -- attempts to maximise clustering if this is true
   * @return {DateTime} -- best start date time for event
   * @private
   */
  _chooseFromHistory: (freeTimes, historyFreq, duration, isClustered) => {
    let maxTimeSlotValue = 0;
    let bestTimeSlot = null;
    for (const timeSlot of freeTimes) {
      let begin = timeSlot[0];
      const end = timeSlot[1];
      if (isClustered) {
        let v = context.getTimeSlotValue(begin, begin.plus(duration), historyFreq);
        if (bestTimeSlot === null || v > maxTimeSlotValue) {
          maxTimeSlotValue = v;
          bestTimeSlot = begin;
        }
        v = context.getTimeSlotValue(end, end.plus(duration), historyFreq);
        if (v > maxTimeSlotValue) {
          maxTimeSlotValue = v;
          bestTimeSlot = begin;
        }
      } else {
        while (begin <= end) {
          const v = context.getTimeSlotValue(begin, begin.plus(duration), historyFreq);
          if (v > maxTimeSlotValue) {
            maxTimeSlotValue = v;
            bestTimeSlot = new DateTime(begin);
          }
          begin = begin.plus(halfHour);
        }
      }
    }
    return bestTimeSlot;
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

  /**
   *
   * @param { Array } lastMonthBusySchedule [{startTime
   * : ISO String, endTime: ISO String}]
   * @return {[]}
   */
  getUserHistory: (lastMonthBusySchedule) => {
    const frequencies = [];
    for (let i = 0; i < days; i++) {
      frequencies[i] = Array(halfHoursInDay).fill(0);
    }
    for (const timeSlot of lastMonthBusySchedule) {
      let begin = DateTime.fromISO(timeSlot.start);
      const end = DateTime.fromISO(timeSlot.end);
      // console.log('begin: ', begin.weekday, ' end: ', end.weekday);
      const startHour = begin.hour;
      const startHalf = begin.minute >= 30 ? 1 : 0;
      let i = startHour * 2 + startHalf;
      // console.log('i: ', i);
      while (begin < end) {
        const day = begin.weekday - 1;
        frequencies[day][i]++;
        i = (i + 1) % halfHoursInDay;
        begin = begin.plus(halfHour);
      }
    }
    return frequencies;
  },
};

// const weekdays = [1, 1, 1, 1, 1, 0, 0];
// const timeslots = [{startTime: '2020-11-09T17:00:00.000Z', endTime: '2020-11-09T19:00:00.000Z'}];
// const output = context.generateConstraints(weekdays, timeslots);

module.exports = context;
