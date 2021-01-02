const { DateTime, Duration } = require("luxon");

const DIALOGFLOW = require("../lib/dialogflow.js");
// const PLOT = require('plotter').plot;

/* CONSTANTS */
const halfHoursInDay = 24 * 2;
const halfHour = Duration.fromObject({ minutes: 30 });
const LEISURE = 0;
const UNKNOWN = -1;
const WORK = 1;

const context = {
  /**
   * Internal function that takes two DateTime objects and returns their intersection, if that
   * intersection is of a minimum size
   *
   * @param { DateTime } slot1 - TODO: Description
   * @param { DateTime } slot2 - TODO: Description
   * @param { duration } duration minimum size of intersection
   * @return { DateTime } intersection of slot1 and slot2 or null
   */
  intersection: (slot1, slot2, duration) => {
    const newSlot = [
      DateTime.max(slot1[0], slot2[0]),
      DateTime.min(slot1[1], slot2[1]),
    ];
    return newSlot[0].plus(duration) <= newSlot[1] ? newSlot : null;
  },

  /**
   * Internal function that takes two objects, one for date info and one for
   * time info, and returns a DateTime based on it
   *
   * @param {object} date object with year, month and day fields
   * @param {object} time object with hour and minute fields
   * @return { DateTime } - TODO: Description
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
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param { Array } ranges - TODO: Description
   * @return { Array } - TODO: Description
   */
  merge: (ranges) => {
    const result = [];
    let last = null;
    ranges.forEach(function (r) {
      if (last) {
        if (r[0] > last[1]) {
          result.push((last = r));
        } else if (r[1] > last[1]) {
          last[1] = r[1];
        }
      } else {
        result.push((last = r));
      }
    });
    return result;
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param {Array} weekAvailability [[{startTime: X, endTime: Y}],...] list
   * of time constraints for every day of the week
   * @param { string } _start ISO Date/Time format, represents start
   * DateTime that event can occur
   * @param { string } _end ISO Date/Time format, represents end DateTime
   * @return { Array } [[ dateTime, dateTime ], ...]
   */
  generateConstraints: (weekAvailability, _start, _end) => {
    if (
      weekAvailability == null ||
      weekAvailability.length < 1 ||
      weekAvailability.flat(1) < 1
    ) {
      return [];
    }
    // merge overlapping intervals + sort
    weekAvailability = weekAvailability.map((dayAvailabilities) => {
      return context.merge(
        dayAvailabilities
          .map((a) => [
            DateTime.fromISO(a.startTime),
            DateTime.fromISO(a.endTime),
          ])
          .sort(function (a, b) {
            return a[0] - b[0] || a[1] - b[1];
          })
      );
    });

    let start = DateTime.fromISO(_start);
    const end = DateTime.fromISO(_end);
    let day = start.weekday - 1;
    const res = [];
    while (start <= end) {
      // if (weekAvailability[day].length < 1) {
      //   res.push([context.combine(start, DateTime.fromObject({hour: 0, minute: 0})),
      //     context.combine(start, DateTime.fromObject({hour: 23, minute: 59, second: 59, millisecond: 999}))]);
      // }
      if (weekAvailability[day].length > 0) {
        weekAvailability[day].forEach(function (timeSlot) {
          if (timeSlot[0] !== "" && timeSlot[1] !== "") {
            res.push([
              context.combine(start, timeSlot[0]),
              context.combine(start, timeSlot[1]),
            ]);
          }
        });
      }
      day = (day + 1) % 7;
      start = start.plus({ days: 1 });
    }
    return res;
  },

  /**
   * Takes in a team's schedules, the duration of the event and any other
   * constraints, and will return all possible times that the event can take
   * place.
   *
   * @param { Array } schedules array of array of array of 2 DateTimes
   * in the format [[[startTime , endTime], ...]]
   * @param { Duration } duration duration of the event
   * @param { Array } constraints array of array of two DateTimes, in
   * the format [[startTime, endTime]]
   * @return { Array } array of array of two DateTimes, in the format
   * [[startTime, endTime]]
   */
  _schedule: (schedules, duration, constraints = null) => {
    // handle invalid input
    if (!schedules || !schedules.length || !duration) return null;

    if (constraints && constraints.length > 0)
      schedules = schedules.concat(constraints);

    // find intersection of all the given schedules
    let ans = schedules[0];
    schedules.forEach((schedule) => {
      const curr = [];
      let i = 0;
      let j = 0;
      while (i < ans.length && j < schedule.length) {
        // find intersection
        const intersection = context.intersection(
          ans[i],
          schedule[j],
          duration
        );
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
   *
   * @param { Array } freeTimes times that event could be scheduled
   * @return { DateTime } chosen time for the event
   */
  _choose: (freeTimes) => {
    const choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    console.log("choices: ", choices);
    choices.sort((a, b) => a[1] - b[1]);
    if (choices.length === 0) {
      return null;
    }
    return choices[0][0];
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param {DateTime} begin - TODO: Description
   * @param {DateTime} end - TODO: Description
   * @param {Array} historyFreq - TODO: Description
   * @return {number} - TODO: Description
   */
  getTimeSlotValue: (begin, end, historyFreq) => {
    const startHour = begin.hour;
    const startHalf = begin.minute >= 30 ? 1 : 0;
    let val = 0;
    let i = startHour * 2 + startHalf;
    while (begin < end) {
      const day = begin.weekday - 1;
      // val += historyFreq[day][i] > 0 ? historyFreq[day][i] ** 2 : -1 * (historyFreq[day][i] ** 2);
      val += historyFreq[day][i];
      i = (i + 1) % halfHoursInDay;
      begin = begin.plus(halfHour);
    }
    return val;
  },

  /**
   * Chooses the best time slot out of list of free times considering the
   * user's history of most common busy times
   *
   * @param {Array} freeTimes - returned by _schedule [[start1, start2]]
   * @param {Array} historyFreqs -- array of arrays returned by userHistory()
   * @param {Duration} duration -- event's duration
   * @param {number} category - TODO: Description
   * @param {Array} freeTimes.freeTimes - TODO: Description
   * @param {Array} freeTimes.historyFreqs - TODO: Description
   * @param {number} freeTimes.duration - TODO: Description
   * @param {number} freeTimes.category - TODO: Description
   * @return {DateTime} -- best start date time for event
   * @private
   */
  _chooseFromHistory: ({ freeTimes, historyFreqs, duration, category }) => {
    // sum history freqs together to make one for everyone
    if (historyFreqs.length < 1) {
      console.log("error in _chooseFromHistory: no history freqs given");
      return null;
    }
    const historyFreq = historyFreqs[0];
    if (historyFreqs.length > 1) {
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 24 * 2; j++) {
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
    let clusterP = -1000;
    let bestClusterTimeSlot = null;
    let bestP = -1000;
    let bestPTimeSlot = null;
    const fifteenMins = Duration.fromObject({ minutes: 15 });
    const day0 = freeTimes.length > 0 ? freeTimes[0][0] : null;

    // console.log('day0', day0?day0.toString(): 'none');

    // minimise the break val whilst being at least the minBreakLength
    for (const timeSlot of freeTimes) {
      let begin = timeSlot[0];
      const end = timeSlot[1];
      const diffInWeeks = Math.floor(
        begin.diff(day0, ["days"]).values.days / 7
      );
      const distanceWeight =
        (3 * (diffInWeeks + 2)) / (20 * diffInWeeks ** 2 + 20) + 0.7;
      // console.log('diffInWeeks', diffInWeeks, ' -> distance weight -> ', distanceWeight, begin.toString());

      let p1 = context.getTimeSlotValue(begin, begin.plus(duration), historyFreq);
      p1 > 0 ? p1 *= distanceWeight : null;
      let p2 = context.getTimeSlotValue(end, end.plus(duration), historyFreq) * distanceWeight;
      p2 > 0 ? p2 *= distanceWeight : null;

      if (clusterP < p1) {
        clusterP = p1;
        bestClusterTimeSlot = new DateTime(begin);
      }
      if (clusterP < p2) {
        clusterP = p2;
        bestClusterTimeSlot = new DateTime(end);
      }
      // console.log('begin: ', begin.toString(), ' -> ', p1, ' end: ', end.toString(), ' -> ', p2, ' bestCluster', bestClusterTimeSlot.toString(), ' -> ', clusterP);
      begin = begin.plus(fifteenMins);
      while (begin < end) {
        const p3 =
          context.getTimeSlotValue(begin, begin.plus(duration), historyFreq) *
          distanceWeight;
        if (bestP < p3) {
          bestP = p3;
          bestPTimeSlot = new DateTime(begin);
        }
        // console.log('time: ', begin.toString(), ' -> ', p3, ' bestPTimeSlot ', bestPTimeSlot.toString(), ' -> ', bestP);
        begin = begin.plus(fifteenMins);
      }
    }
    // only bias to cluster work events and bias slightly more for tighter spaced:
    let clusterBias = category === WORK || category === UNKNOWN ?
        (clusterP > 0 ? 1.3 : 0.7) :
        1;

    if (clusterP * clusterBias < bestP) {
      // console.log('--p wins-- bestP: ', bestPTimeSlot.toString(), ' -> ', bestP, '  clusterP: ', bestClusterTimeSlot.toString(), ' -> ', clusterP);
      return bestPTimeSlot;
    } else {
      // console.log('--cluster wins-- bestClusterP: ', bestClusterTimeSlot.toString(), ' -> ', clusterP * clusterBias, ' bestP: ', bestPTimeSlot.toString(), ' -> ', bestP);
      return bestClusterTimeSlot;
    }
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param {Array} busySlots - TODO: Description
   * @param {string} startISO - TODO: Description
   * @param {string} endISO - TODO: Description
   * @param {Duration} minBreakLength // array of every user's minimum break length
   * @param {Array} timeConstraints - TODO: Description [{ String, String }]
   * @return {Array} - TODO: Description
   */
  getFreeSlots: (
    busySlots,
    startISO,
    endISO,
    minBreakLength = Duration.fromObject({ minutes: 0 }),
    timeConstraints
  ) => {
    console.log("---getFreeSlots---");
    // Parse workDays into a usable format
    console.log(timeConstraints);
    timeConstraints = timeConstraints.map((day) =>
      day.length > 0
        ? [DateTime.fromISO(day[0].startTime), DateTime.fromISO(day[0].endTime)]
        : []
    );

    // console.log('timeConstraints: ', timeConstraints.map((interval) => (interval.length > 0 ? [interval[0].toString(), interval[1].toString()] : [])));

    // If there are no busy slots return entire search period
    const searchStart = DateTime.fromISO(startISO);
    const searchEnd = DateTime.fromISO(endISO);
    if (!busySlots.length) {
      console.log("no busy slots found -- return whole period");
      return context.freeSlotsAux(searchStart, searchEnd, timeConstraints);
    }

    // Parse busy slots as DateTime objects
    busySlots = busySlots.map((x) => {
      x[0] = DateTime.fromISO(x[0]).minus(minBreakLength);
      x[1] = DateTime.fromISO(x[1]).plus(minBreakLength);
      return x;
    });
    busySlots.push([searchEnd, searchEnd.endOf("day")]);
    // console.log('parsed busySlots: ', busySlots.map((slot) => [slot[0].toString(), slot[1].toString()]));

    // Initialise variables for generating free slots
    const fiveSeconds = Duration.fromObject({ seconds: 5 });
    const oneDay = Duration.fromObject({ days: 1 });
    let freeSlots = [];
    let prevBusySlotEnd = searchStart;
    let currDayBegin = null;
    let currDayEnd = null;

    // Set initial values if possible
    const initialDay = searchStart.weekday - 1;

    if (timeConstraints[initialDay].length > 0) {
      currDayBegin = DateTime.max(
        context.combine(searchStart, timeConstraints[initialDay][0]),
        searchStart
      );
      currDayEnd = DateTime.min(
        context.combine(searchStart, timeConstraints[initialDay][1]),
        searchEnd
      );
    }
    // Generate free time slots
    for (let i = 0; i < busySlots.length; i++) {
      const busyTimeSlot = busySlots[i];
      const day = busyTimeSlot[0].weekday - 1;

      // console.log('\n\nbusytimeslot: ', busyTimeSlot[0].toString(), busyTimeSlot[1].toString());

      // If we are on a new day, update the begin and end for that day.
      const daysApart = busyTimeSlot[0]
        .startOf("day")
        .diff(prevBusySlotEnd.startOf("day"), "days");
      // console.log('days apart: ', daysApart.values.days);
      if (daysApart.days > 0) {
        // generates the rest of the current working day
        if (currDayBegin && currDayEnd - currDayBegin > fiveSeconds) {
          console.log("1");
          freeSlots.push([currDayBegin, currDayEnd]);
        }
        // updates begin and end for current busy slot's day
        // console.log('workdays[', day, '] ', workDays[day].toString());
        if (timeConstraints[day].length > 0) {
          // console.log('currDayBegin b[0]', busyTimeSlot[0] );
          // console.log('currDayBegin td0', timeConstraints[day]);
          currDayBegin = context.combine(
            busyTimeSlot[0],
            timeConstraints[day][0]
          );
          currDayEnd = context.combine(
            busyTimeSlot[0],
            timeConstraints[day][1]
          );
        } else {
          currDayBegin = null;
          currDayEnd = null;
        }
        // if between busy slots, there is a day/s not scheduled in, then generate free slots for those days
        if (daysApart.days > 1) {
          const endDate = busyTimeSlot[0].minus(oneDay);
          prevBusySlotEnd = prevBusySlotEnd.plus(oneDay);
          freeSlots = freeSlots.concat(
            context.freeSlotsAux(prevBusySlotEnd, endDate, timeConstraints)
          );
        }
        // console.log('mappp', freeSlots.map((slot) => [slot[0].toString(), slot[1].toString()]));
      }
      prevBusySlotEnd = busyTimeSlot[0];

      // We loop through slots until these conditions are met before generating free slots:
      // 1. begin < end, this allows us to ignore time slots after end, as begin increases over time
      // 2. slotEnd < begin, this allows us to ignore time slots before initial begin value
      // 3. not (slot < begin < slotEnd), we don't want to generate inside an existing time slot
      if (currDayBegin && currDayBegin < currDayEnd) {
        if (currDayBegin < busyTimeSlot[0]) {
          freeSlots.push([
            currDayBegin,
            DateTime.min(busyTimeSlot[0], currDayEnd),
          ]);
        }
        currDayBegin = DateTime.max(currDayBegin, busyTimeSlot[1]);
      }
    }

    return freeSlots;
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param { DateTime } start - TODO: Description
   * @param { DateTime } end - TODO: Description
   * @param { Array } timeConstraints - TODO: Description [{DateTime, DateTime}]
   * @return { Array } - TODO: Description
   */
  freeSlotsAux: (start, end, timeConstraints) => {
    const oneDay = Duration.fromObject({ days: 1 });
    const freeSlots = [];
    start = start.startOf("day");
    end = end.endOf("day");
    while (start <= end) {
      const day = start.weekday - 1;
      if (timeConstraints[day].length > 0) {
        freeSlots.push([
          context.combine(start, timeConstraints[day][0]),
          context.combine(start, timeConstraints[day][1]),
        ]);
      }
      start = start.plus(oneDay);
    }
    // console.log('mappp', freeSlots.map((slot) => [slot[0].toString(), slot[1].toString()]));
    return freeSlots;
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param { Array } freeTimes - TODO: Description
   * @param { Duration } duration - TODO: Description
   * @param { Array } historyFreqs - TODO: Description
   * @param {number} category - TODO: Description
   * @return {null|{start: string, end: string}} - TODO: Description
   */
  findMeetingSlot(freeTimes, duration, historyFreqs, category) {
    if (!freeTimes || freeTimes.length === 0) {
      console.log("nothing found: ", freeTimes);
      return null;
    }
    // for (let i = 0; i < 7; i++) {
    //   PLOT({
    //     data: historyFreqs[0][i],
    //     filename: `output_${i}.svg`,
    //     format: 'svg',
    //   });
    // }
    const timeSlots = context._schedule(freeTimes, duration);
    console.log(
      "free times ",
      freeTimes[0].map((interval) => [
        interval[0].toString(),
        interval[1].toString(),
      ])
    );
    console.log(
      "free timeslots ",
      timeSlots.map((interval) => [
        interval[0].toString(),
        interval[1].toString(),
      ])
    );
    // TODO: Amelia + Hasan: Why are the parameters passed as an object?
    const choice = context._chooseFromHistory({
      freeTimes: timeSlots,
      historyFreqs: historyFreqs,
      duration: duration,
      category: category,
    });
    if (choice) {
      return {
        start: choice.toISO(),
        end: choice.plus(duration).toISO(),
      };
    }
    return null;
  },

  /**
   *TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param {Array} lastMonthBusySchedule - TODO: Description
   * @return {Promise} - TODO: Description
   */
  async getCategorisedSchedule(lastMonthBusySchedule) {
    const x = [];
    for (const timeSlot of lastMonthBusySchedule) {
      const c = await DIALOGFLOW.getCategory(timeSlot[2]);
      x.push([timeSlot, c]);
    }
    return x;
  },

  /**
   *TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param {number} category - TODO: Description
   * @return {any[]} - TODO: Description
   */
  initialiseHistFreqs(category) {
    const frequencies = Array(7);
    // // initialise history frequencies to default for this category
    // default leisure hist freq:
    if (category === LEISURE) {
      // workdays are less popular
      for (let i = 0; i < 5; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 18; i++) vals[i] = -8.2 + 0.4 * i;
        for (let i = 19; i < 24; i++) vals[i] = -1;
        for (let i = 24; i < 28; i++) vals[i] = -2;
        for (let i = 28; i <= 34; i++) vals[i] = -1;
        for (let i = 35; i <= 36; i++) vals[i] = -35 + i;
        for (let i = 37; i <= 42; i++) vals[i] = 1;
        for (let i = 43; i < 48; i++) vals[i] = 43 - i;
        frequencies[i] = vals;
      }
      // weekend days are more popular
      for (let i = 5; i < 7; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 16; i++) vals[i] = -10 + 0.625 * i;
        for (let i = 17; i <= 21; i++) vals[i] = 0;
        for (let i = 22; i <= 23; i++) vals[i] = 1;
        for (let i = 24; i <= 27; i++) vals[i] = -1;
        for (let i = 28; i <= 40; i++) vals[i] = 1;
        for (let i = 41; i < 48; i++) vals[i] = 31 - (3 / 4) * i;
        frequencies[i] = vals;
      }
    }
    // default work hist freq:
    if (category === WORK || category === UNKNOWN) {
      // weekend days are LESS popular
      for (let i = 5; i < 7; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i <= 20; i++) vals[i] = -5 - 8 / 3 + (1 / 3) * i;
        for (let i = 21; i < 24; i++) vals[i] = -1;
        for (let i = 24; i < 28; i++) vals[i] = -2;
        for (let i = 28; i <= 38; i++) vals[i] = -1;
        for (let i = 39; i < 48; i++) vals[i] = 14.2 - 0.4 * i;
        frequencies[i] = vals;
      }
      // week days are MORE popular
      for (let i = 0; i < 5; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 8; i++) vals[i] = -5;
        for (let i = 9; i < 18; i++) vals[i] = -9.8 + 0.6 * i;
        for (let i = 18; i < 24; i++) vals[i] = 1;
        for (let i = 24; i <= 27; i++) vals[i] = -2;
        for (let i = 28; i <= 34; i++) vals[i] = 1;
        for (let i = 35; i <= 42; i++) vals[i] = 0;
        for (let i = 43; i < 48; i++) vals[i] = 35 - (5 / 6) * i;
        frequencies[i] = vals;
      }
    }
    return frequencies;
  },

  /**
   * TODO: Amelia + Hasan: Comment and descriptions
   *
   * @param { Array } categorisedSchedule given in the format:
   * [{startTime: ISO String, endTime: ISO String}]
   * @param { number } category - TODO: Description
   * @return { Array } frequencies for each half hour time slot for this user
   */
  async generateUserHistory(categorisedSchedule, category) {
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
    let smallest = frequencies[0][0];
    let largest = frequencies[0][0];

    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < halfHoursInDay; j++) {
        if (frequencies[i][j] < smallest) {
          smallest = frequencies[i][j];
        } else if (frequencies[i][j] > largest) {
          largest = frequencies[i][j];
        }
      }
    }
    // TODO: fix this!
    // frequencies = frequencies.map((arr)=>arr.map((a) => (a+Math.abs(smallest))));
    return frequencies;
  },
};

module.exports = context;
