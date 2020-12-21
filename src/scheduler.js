const {DateTime, Duration} = require('luxon');

const DIALOGFLOW = require('../lib/dialogflow.js');

/* CONSTANTS */
const halfHoursInDay = 24 * 2;
const days = 7;
const halfHour = Duration.fromObject({minutes: 30});
const dictHourToDefaultFreq = {};
for (let i = 0; i < 7; i++) {
  dictHourToDefaultFreq[i] = -15 + 2*i;
}
for (let i = 7; i < 23; i++) {
  dictHourToDefaultFreq[i] = -1;
}
for (let i = 23; i <= 24; i++) {
  dictHourToDefaultFreq[i] = -3;
}

const context = {
  /**
   * Internal function that takes two datetime objects and returns their intersection, if that
   * intersection is of a minimum size
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
   * @param { Array } weekdayAvailable array of boolean flags [1,0,1,0,0,0,0]
   * @param { Array } availableTimes [{startTime: x, endtime: y}], where startTime < endtime
   * @param { Int } weeks number of weeks to produce availablity for
   * @return { Array } [[ dateTime, dateTime ], ...],
   * [[{startTime: X, endTime: Y},...],...]
   */
  oldGenerateConstraints: (weekdayAvailable, availableTimes, weeks=1) => {
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
   *
   * @param { Array } ranges
   * @return { Array }
   */
  merge: (ranges) => {
    const result = [];
    let last = null;
    ranges.forEach(function(r) {
      if (last) {
        if (r[0] > last[1]) {
          result.push(last = r);
        } else if (r[1] > last[1]) {
          last[1] = r[1];
        }
      } else {
        result.push(last = r);
      }
    });
    return result;
  },
  /**
   *
   * @param {Array} weekAvailability [[{startTime: X, endTime: Y}],...]list of time constraints for every day of the week
   * @param { string } _start ISO Date/Time format, represents start DateTime that event can occur
   * @param { string } _end ISO Date/Time format, represents end DateTime
   * @return { Array } [[ dateTime, dateTime ], ...]
   */
  generateConstraints: (weekAvailability, _start, _end) => {
    if (weekAvailability == null ||
        weekAvailability.length < 1) {
      return [];
    }
    // merge overlapping intervals + sort
    weekAvailability = weekAvailability.map((dayAvailabilities) => {
      return context.merge(dayAvailabilities
          .map((a) => [DateTime.fromISO(a.startTime), DateTime.fromISO(a.endTime)])
          .sort(function(a, b) {
            return a[0] - b[0] || a[1] - b[1];
          }));
    });

    let start = DateTime.fromISO(_start);
    const end = DateTime.fromISO(_end);
    let day = start.weekday - 1;
    const res = [];
    while (start <= end) {
      if (weekAvailability[day].length < 1) {
        res.push([context.combine(start, DateTime.fromObject({hour: 0, minute: 0})),
          context.combine(start, DateTime.fromObject({hour: 23, minute: 59, second: 59, millisecond: 999}))]);
      } else {
        weekAvailability[day].forEach(function(timeSlot) {
          if (timeSlot[0] !== '' && timeSlot[1] !== '') {
            res.push([context.combine(start, timeSlot[0]), context.combine(start, timeSlot[1])]);
          }
        });
      }
      day = (day + 1) % 7;
      start = start.plus({days: 1});
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
    // handle invalid input
    if (!schedules ||
      !schedules.length ||
      !duration) return null;

    // console.log('schedules ', schedules.map((schedule)=> schedule.map((interval)=>[interval[0].toString(), interval[1].toString()])));
    // console.log('constraints ', constraints.map((person)=>person.map((interval)=>[interval[0].toString(), interval[1].toString()])));
    // include availability constraints
    if (constraints != null && constraints.length > 0) schedules = schedules.concat(constraints);
    // console.log(schedules[0][0][0].toString(), schedules[0][0][1].toString(), schedules[0][1][0].toString(), schedules[0][1][1].toString(), );
    // console.log('schedules: ', schedules.map((schedule)=>{schedule.map((freeTime)=>[freeTime[0], freeTime[1]])}));

    // find intersection of all the given schedules
    let ans = schedules[0];
    schedules.forEach((schedule) => {
      const curr = [];
      let i = 0; let j = 0;
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
    console.log('choices: ', choices);
    choices.sort((a, b) => a[1] - b[1]);
    if (choices.length === 0) {
      console.log('here');
      return null;
    }
    return choices[0][0];
  },
  getTimeSlotValue: (begin, end, historyFreq) => {
    const startHour = begin.hour;
    const startHalf = begin.minute >= 30 ? 1 : 0;
    let val = 0;
    let i = startHour * 2 + startHalf;
    while (begin < end) {
      const day = begin.weekday - 1;
      val += historyFreq[day][i] > 0 ? historyFreq[day][i] ** 2 : -1 * (historyFreq[day][i] ** 2);
      i = (i + 1) % halfHoursInDay;
      begin = begin.plus(halfHour);
    }
    return val;
  },
  /**
   * chooses the best time slot out of list of free times considering the user's history of most
   * common busy times
   * @param {Array} freeTimes -- array returned by _schedule [[start1, start2]]
   * @param {Array} historyFreqs -- array of arrays returned by userHistory()
   * @param {Duration} duration -- event's duration
   * @return {DateTime} -- best start date time for event
   * @private
   */
  _chooseFromHistory: (freeTimes, historyFreqs, duration) => {
    // sum history freqs together to make one for everyone
    console.log('---_chooseFromHistory---');
    // console.log('freetimes: ', freeTimes[0]);
    if (historyFreqs.length < 1) {
      console.log('error in _chooseFromHistory: no history freqs given');
      return null;
    }
    const historyFreq = historyFreqs[0];
    if (historyFreqs.length > 1) {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 24*2; j++) {
          for (const h of historyFreqs) {
            historyFreq[i][j] += h[i][j];
          }
        }
      }
    }
    // console.log('combined', historyFreq);
    // let choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    // choices.sort((a, b) => a[1] - b[1]);
    // choices = choices.map((timeSlot) => [timeSlot[0], timeSlot[1], timeSlot[1].diff(timeSlot[0]).minutes]);
    // console.log(choices);
    let maxTimeSlotValue = -10000;
    let bestTimeSlot = null;
    let bestClusterVal = 1000000;
    for (const timeSlot of freeTimes) {
      let begin = timeSlot[0];
      const end = timeSlot[1];
      // clusterval represents how well clustered this event is -- wanna minimise this value
      let clusterVal = end.diff(begin, ['minutes', 'hours']);
      console.log('begin: ', begin.toString(), '\t\tend: ', end.toString(), '\t\tclusterval: ', clusterVal.values.hours * 60 + clusterVal.values.minutes);
      clusterVal = clusterVal.values.hours * 60 + clusterVal.values.minutes;
      while (begin <= end) {
        const v = context.getTimeSlotValue(begin, begin.plus(duration), historyFreq);
        if (v > maxTimeSlotValue) {
          maxTimeSlotValue = v;
          bestTimeSlot = new DateTime(begin);
          bestClusterVal = clusterVal;
        } else if (v === maxTimeSlotValue) {
          if (clusterVal < bestClusterVal) {
            bestClusterVal = clusterVal;
            bestTimeSlot = new DateTime(begin);
          }
        }
        begin = begin.plus(halfHour);
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
    if (begin >= busySlots[0][0] && begin < busySlots[0][1]) {
      begin = busySlots[0][1];
    }
    const freeSlots = [];
    for (let i = 0; i < busySlots.length; i++) {
      const busyTimeSlot = busySlots[i];
      console.log('busytimeslot[', i, ']', ' ', busyTimeSlot[0].toISO(), busyTimeSlot[1].toISO(), freeSlots.length);
      if (busyTimeSlot[1] > end) {
        break;
      }
      if (begin < busyTimeSlot[0]) {
        freeSlots.push([begin, busyTimeSlot[0]]);
        begin = busyTimeSlot[1];
      }
    }
    if (end - begin > Duration.fromObject({seconds: 5})) {
      freeSlots.push([begin, end]);
    }
    console.log('xxx');
    freeSlots.forEach((x) => console.log('abc', x[0].c, x[1].c));
    return freeSlots;
  },
  /**
   *
   * @param { Array } freeTimes
   * @param { Duration } duration
   * @param { Array } constraints
   * @param { Array } historyFreqs
   * @return {null|{start: string, end: string}}
   */
  findMeetingSlot(freeTimes, duration, constraints = null, historyFreqs) {
    // TODO: Change this to return something even if it clashes! Maybe try reschedule other things!
    if (!freeTimes || freeTimes.length === 0) {
      // no free time slot found
      return null;
    }
    const timeSlots = context._schedule(freeTimes, duration, constraints);
    // console.log('timeslots ', timeSlots.map((interval) => [interval[0].toString(), interval[1].toString()]));
    const choice = context._chooseFromHistory(timeSlots, historyFreqs, duration);
    if (choice) {
      return {
        start: choice.toISO(),
        end: choice.plus(duration).toISO(),
      };
    }
    return null;
  },
  /**
   *
   * @param { Array } lastMonthBusySchedule [{startTime: ISO String, endTime: ISO String}]
   * @param { Integer } category
   * @return {[]} array of frequencies for each half hour time slot for this user
   */
  async getUserHistory(lastMonthBusySchedule, category) {
    console.log('---getUserHistory---');
    console.log('category: ', category);
    const frequencies = [];
    // initialise history frequencies to default
    for (let i = 0; i < days; i++) {
      const vals = Array(halfHoursInDay).fill(0);
      for (let j = 0; j < halfHoursInDay; j++) {
        vals[j] = dictHourToDefaultFreq[Math.floor(j/2)];
      }
      frequencies[i] = vals;
    }
    for (const timeSlot of lastMonthBusySchedule) {
      const c = await DIALOGFLOW.getCategory(timeSlot[2]);
      let sign = 1;
      if (c === -1) {
        // don't weight against un-categorised events
        sign = 0;
      } else if (c !== category) {
        sign = -1;
      }
      let begin = DateTime.fromISO(timeSlot[0]);
      const end = DateTime.fromISO(timeSlot[1]);
      const startHour = begin.hour;
      const startHalf = begin.minute >= 30 ? 1 : 0;
      let i = startHour * 2 + startHalf;
      while (begin < end) {
        const day = begin.weekday - 1;
        frequencies[day][i] = frequencies[day][i] + sign;
        i = (i + 1) % halfHoursInDay;
        begin = begin.plus(halfHour);
      }
    }
    return frequencies;
  },
};

module.exports = context;
