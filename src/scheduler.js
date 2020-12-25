const {DateTime, Duration} = require('luxon');

const DIALOGFLOW = require('../lib/dialogflow.js');
// const PLOT = require('plotter').plot;

/* CONSTANTS */
const halfHoursInDay = 24 * 2;
const halfHour = Duration.fromObject({minutes: 30});
const LEISURE = 0;
const UNKNOWN = -1;
const WORK = 1;

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
        weekAvailability.length < 1 || weekAvailability.flat(1) < 1) {
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
    // console.log('---schedule---');

    // handle invalid input
    if (!schedules ||
      !schedules.length ||
      !duration) return null;

    // console.log('free time schedules ', schedules.map((schedule)=> schedule.map((interval)=>[interval[0].toString(), interval[1].toString()])));
    // console.log('constraints ', constraints.map((person)=>person.map((interval)=>[interval[0].toString(), interval[1].toString()])));
    // include availability constraints
    if (constraints.length > 0) schedules = schedules.concat(constraints);
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
   * @param {Boolean} cluster
   * @return {DateTime} -- best start date time for event
   * @private
   */
  _chooseFromHistory: ({freeTimes, historyFreqs, duration, cluster}) => {
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

    if (cluster) {
      // minimise the break val whilst being at least the minBreakLength
      let bestBreakVal = 1000000;
      for (const timeSlot of freeTimes) {
        let begin = timeSlot[0];
        const end = timeSlot[1];
        // breakLength represents how well clustered this event is/break time between meetings --
        // if want back-to-back then wanna minimise this value whilst being at least the minimum required by user
        let breakLength = end.diff(begin, ['minutes']);
        // console.log('begin: ', begin.toString(), ' end: ', end.toString(), ' \t\tbreaklength: ', breakLength.minutes);
        // console.log('begin: ', begin.toString(), '\t\tend: ', end.toString(), '\t\tclusterval: ', clusterVal.values.hours * 60 + clusterVal.values.minutes);
        breakLength = breakLength.values.hours * 60 + breakLength.values.minutes;
        while (begin <= end) {
          const v = context.getTimeSlotValue(begin, begin.plus(duration), historyFreq);
          if (v > maxTimeSlotValue) {
            maxTimeSlotValue = v;
            bestTimeSlot = new DateTime(begin);
            bestBreakVal = breakLength;
          } else if (v === maxTimeSlotValue) {
            if (breakLength < bestBreakVal && breakLength >= minBreakLength) {
              bestBreakVal = breakLength;
              bestTimeSlot = new DateTime(begin);
            }
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
  // eslint-disable-next-line valid-jsdoc
  /**
   *
   * @param { Array } busySlots
   * @param { String } startISO
   * @param { String } endISO
   * @param { Duration } minBreakLength // array of every user's minimum break length
   * @return {[]|DateTime[][]}
   */
  getFreeSlots: (busySlots, startISO, endISO, minBreakLength=Duration.fromObject({minutes: 0})) => {
    console.log('---getFreeSlots---');
    // Parse start and end times
    let begin = DateTime.fromISO(startISO);
    const end = DateTime.fromISO(endISO);

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
    if (begin >= busySlots[0][0].minus(minBreakLength) && begin < busySlots[0][1].plus(minBreakLength)) {
      begin = (busySlots[0][1]).plus(minBreakLength);
    }
    const freeSlots = [];
    for (let i = 0; i < busySlots.length; i++) {
      const busyTimeSlot = busySlots[i];
      // console.log('busytimeslot[', i, ']', ' ', busyTimeSlot[0].toISO(), busyTimeSlot[1].toISO(), freeSlots.length);
      if (busyTimeSlot[1].plus(minBreakLength) > end) {
        break;
      }
      if (begin >= busyTimeSlot[0].minus(minBreakLength) && begin < busyTimeSlot[1].plus(minBreakLength)) {
        begin = (busyTimeSlot[1]).plus(minBreakLength);
      }
      // console.log('begin minus', busyTimeSlot[0].minus(minBreakLength).toISO(), busyTimeSlot[0].toISO());
      if (begin < busyTimeSlot[0].minus(minBreakLength)) {
        freeSlots.push([begin, busyTimeSlot[0].minus(minBreakLength)]);
        console.log(busyTimeSlot[0].minus(minBreakLength).toISO(),busyTimeSlot[1].plus(minBreakLength).toISO(), freeSlots.map((interval) => [interval[0].toString(), interval[1].toString()]));
        begin = busyTimeSlot[1].plus(minBreakLength);
      }
    }
    if (end - begin > Duration.fromObject({seconds: 5})) {
      freeSlots.push([begin, end]);
    }
    // console.log('xxx');
    // freeSlots.forEach((x) => console.log('abc', x[0].c, x[1].c));
    return freeSlots;
  },
  /**
   *
   * @param { Array } freeTimes
   * @param { Duration } duration
   * @param { Array } constraints
   * @param { Array } historyFreqs
   * @param { Boolean } cluster // whether the user would like their meetings clustered or not
   * @return {null|{start: string, end: string}}
   */
  findMeetingSlot(freeTimes, duration, constraints = null, historyFreqs, cluster = true) {
    console.log('---findMeetingSlot---');
    if (!freeTimes || freeTimes.length === 0) {
      console.log('nothing found: ', freeTimes);
      // no free time slot found
      return null;
    }
    // for (let i = 0; i < 7; i++) {
    //   PLOT({
    //     data: historyFreqs[0][i],
    //     filename: `output_${i}.svg`,
    //     format: 'svg',
    //   });
    // }
    const timeSlots = context._schedule(freeTimes, duration, constraints);
    console.log('free timeslots ', timeSlots.map((interval) => [interval[0].toString(), interval[1].toString()]));
    const choice = context._chooseFromHistory({
      freeTimes: timeSlots,
      historyFreqs: historyFreqs,
      duration: duration,
      cluster: cluster,
    });
    if (choice) {
      return {
        start: choice.toISO(),
        end: choice.plus(duration).toISO(),
      };
    }
    return null;
  },
  async getCategorisedSchedule(lastMonthBusySchedule) {
    const x = [];
    for (const timeSlot of lastMonthBusySchedule) {
      const c = await DIALOGFLOW.getCategory(timeSlot[2]);
      x.push([timeSlot, c]);
    }
    return x;
  },
  initialiseHistFreqs(category) {
    const frequencies = Array(7);
    // // initialise history frequencies to default for this category
    // default leisure hist freq:
    if (category === LEISURE) {
      // workdays are less popular
      for (let i = 0; i < 5; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 18; i++) vals[i] = -8.2+0.4*i;
        for (let i = 19; i < 24; i++) vals[i] = -1;
        for (let i = 24; i < 28; i++) vals[i] = -2;
        for (let i = 28; i <= 34; i++) vals[i] = -1;
        for (let i = 35; i <= 36; i++) vals[i] = -35 + i;
        for (let i = 37; i <= 42; i++) vals[i] = 1;
        for (let i = 43; i < 48; i++) vals[i] = 43-i;
        frequencies[i]=vals;
      }
      // weekend days are more popular
      for (let i = 5; i < 7; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 16; i++) vals[i] = -10 + 0.625*i;
        for (let i = 17; i <= 21; i++) vals[i] = 0;
        for (let i = 22; i <= 23; i++) vals[i] = 1;
        for (let i = 24; i <= 27; i++) vals[i] = -1;
        for (let i = 28; i <= 40; i++) vals[i] = 1;
        for (let i = 41; i < 48; i++) vals[i] = 31 - 3/4 * i;
        frequencies[i]=vals;
      }
    }
    // default work hist freq:
    if (category === WORK || category === UNKNOWN) {
      // weekend days are LESS popular
      for (let i = 5; i < 7; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 20; i++) vals[i] = -5 - 8/3 + 1/3*i;
        for (let i = 21; i < 24; i++) vals[i] = -1;
        for (let i = 24; i < 28; i++) vals[i] = -2;
        for (let i = 28; i <= 38; i++) vals[i] = -1;
        for (let i = 39; i < 48; i++) vals[i] = 14.2-0.4*i;
        frequencies[i]=vals;
      }
      // week days are MORE popular
      for (let i = 0; i < 5; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i < 18; i++) vals[i] = -9.8 + 0.6*i;
        for (let i = 18; i < 24; i++) vals[i] = 1;
        for (let i = 24; i <= 27; i++) vals[i] = -1;
        for (let i = 28; i <= 34; i++) vals[i] = 1;
        for (let i = 35; i <= 42; i++) vals[i] = 0;
        for (let i = 43; i < 48; i++) vals[i] = 35-5/6*i;
        frequencies[i]=vals;
      }
    }
    return frequencies;
  },
  /**
   *
   * @param { Array } categorisedSchedule [{startTime: ISO String, endTime: ISO String}]
   * @param { Integer } category
   * @return {[]} array of frequencies for each half hour time slot for this user
   */
  async generateUserHistory(categorisedSchedule, category) {
    console.log('---generateUserHistory---');
    console.log('category: ', category);
    const frequencies = this.initialiseHistFreqs(category);
    for (const timeSlotCategory of categorisedSchedule) {
      const timeSlot = timeSlotCategory[0];
      const c = timeSlotCategory[1];
      let sign = 1;
      if (c === -1) {
        // don't weight against un-categorised events
        continue;
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
