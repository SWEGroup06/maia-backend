const { DateTime, Duration } = require("luxon");

const DIALOGFLOW = require("../lib/dialogflow.js");
// const PLOT = require("plotter").plot;

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
   * @param { DateTime } slot1
   * @param { DateTime } slot2
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
   * @return { DateTime } combined date + time
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
   * Merges together adjacent free slot intervals
   *
   * @param { Array } ranges is a list of free slot intervals
   * @return { Array } free slot interval without any adjacent intervals
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
   * generates constraints from each day for the times specified in weekAvailability
   *
   * @param {Array} weekAvailability [[{startTime: X, endTime: Y}],...] list
   * of time constraints for every day of the week
   * @param { string } _start ISO Date/Time format, represents start
   * DateTime that event can occur
   * @param { string } _end ISO Date/Time format, represents end DateTime
   * @return { Array } [[ dateTime, dateTime ], ...]
   */
  generateConstraints: (weekAvailability, _start, _end) => {
    if (weekAvailability == null ||
      weekAvailability.length < 1 ||
      weekAvailability.flat(1) < 1) {
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
   * Chooses a time period, preferring time slots which are smaller
   *
   * @param { Array } freeTimes times that event could be scheduled
   * @return { DateTime } chosen time for the event
   */
  _choose: (freeTimes) => {
    const choices = freeTimes.map((xs) => [xs[0], xs[1].diff(xs[0])]);
    choices.sort((a, b) => a[1] - b[1]);
    if (choices.length === 0) {
      return null;
    }
    return choices[0][0];
  },

  /**
   * Gets the evaluation of a time slot from the histogram
   *
   * @param {DateTime} begin is the start of the time slot
   * @param {DateTime} end is the end of the time slot
   * @param {Array} historyFreq is the histogram
   * @return {number} returns the evaluation
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
   * @param {Array} freeTimes is returned by _schedule [[start1, start2]]
   * @param {Array} historyFreqs is an array of arrays returned by userHistory()
   * @param {Duration} duration is the event's duration
   * @param {number} category is the type of event (work / leisure)
   * @param {DateTime} startDate is the starting date of the search region
   * @return {DateTime} - best start date time for event
   * @private
   */
  _chooseFromHistory: (
    freeTimes,
    historyFreqs,
    duration,
    category,
    startDate
  ) => {
    // sum history freqs together to make one for everyone
    if (historyFreqs.length < 1) {
      console.error("_chooseFromHistory Error: No History Frequencies Given");
      return null;
    }
    startDate = startDate.startOf("week");
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
    let clusterP = -1000;
    let bestClusterTimeSlot = null;
    let bestP = -1000;
    let bestPTimeSlot = null;
    const fifteenMins = Duration.fromObject({ minutes: 15 });

    // minimise the break val whilst being at least the minBreakLength
    for (const timeSlot of freeTimes) {
      let begin = timeSlot[0];
      const end = timeSlot[1];
      const diffInWeeks = Math.floor(
        begin.diff(startDate, ["days"]).values.days / 7
      );
      const distanceWeight =
        (3 * (diffInWeeks + 2)) / (20 * diffInWeeks ** 2 + 20) + 0.7;

      const p1 =
        context.getTimeSlotValue(begin, begin.plus(duration), historyFreq) *
        distanceWeight;
      const p2 =
        context.getTimeSlotValue(end, end.plus(duration), historyFreq) *
        distanceWeight;

      if (clusterP < p1) {
        clusterP = p1;
        bestClusterTimeSlot = new DateTime(begin);
      }
      if (clusterP < p2) {
        clusterP = p2;
        bestClusterTimeSlot = new DateTime(end);
      }
      begin = begin.plus(fifteenMins);
      while (begin < end) {
        const p3 =
          context.getTimeSlotValue(begin, begin.plus(duration), historyFreq) *
          distanceWeight;
        if (bestP < p3) {
          bestP = p3;
          bestPTimeSlot = new DateTime(begin);
        }
        begin = begin.plus(fifteenMins);
      }
    }
    // only bias to cluster work events and bias slightly more for tighter spaced:
    const clusterBias = category === WORK || category === UNKNOWN ? 1.3 : 1;

    return clusterP * clusterBias < bestP ? bestPTimeSlot : bestClusterTimeSlot;
  },

  /**
   * Takes a person's calendar events and generates the free time periods
   *
   * @param {Array} busySlots is the calendar events
   * @param {string} startISO is the start of the search region
   * @param {string} endISO is the end of the search region
   * @param {Duration} minBreakLength is the array of every user's minimum break length
   * @param {Array} timeConstraints is the working hours of each user
   * @return {Array} returns an array of free time slots
   */
  getFreeSlots: async (
    busySlots,
    startISO,
    endISO,
    minBreakLength = Duration.fromObject({ minutes: 0 }),
    timeConstraints
  ) => {
    // Parse workDays into a usable format
    timeConstraints = timeConstraints.map((day) =>
      day.length > 0
        ? [DateTime.fromISO(day[0].startTime), DateTime.fromISO(day[0].endTime)]
        : []
    );

    // If there are no busy slots return entire search period
    const searchStart = DateTime.fromISO(startISO);
    const searchEnd = DateTime.fromISO(endISO);
    if (!busySlots.length) {
      console.error(
        "getFreeSlots Error: No Busy Slots Found. Returning Entire Period With Constraints"
      );
      return context.freeSlotsAux(
        searchStart,
        searchEnd,
        timeConstraints,
        true
      );
    }

    // Parse busy slots as DateTime objects
    busySlots = busySlots.map((x) => {
      x[0] = DateTime.fromISO(x[0]).minus(minBreakLength);
      x[1] = DateTime.fromISO(x[1]).plus(minBreakLength);
      return x;
    });
    busySlots.push([searchEnd, searchEnd.endOf("day")]);

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

      // If we are on a new day, update the begin and end for that day.
      const daysApart = busyTimeSlot[0]
        .startOf("day")
        .diff(prevBusySlotEnd.startOf("day"), "days");
      if (daysApart.days > 0) {
        // generates the rest of the current working day
        if (currDayBegin && currDayEnd - currDayBegin > fiveSeconds) {
          freeSlots.push([currDayBegin, currDayEnd]);
        }
        // updates begin and end for current busy slot's day
        if (timeConstraints[day].length > 0) {
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
   * Function generates free time slots for days without any calendar events
   *
   * @param { DateTime } start is the starting day
   * @param { DateTime } end is the ending day
   * @param { Array } timeConstraints is the working hours of the user
   * @param {boolean} considerStartEndTime tells the function not to modify the times
   *                  of start or end.
   * @return { Array } returns an array of free time slots
   */
  freeSlotsAux: (start, end, timeConstraints, considerStartEndTime = false) => {
    const oneDay = Duration.fromObject({ days: 1 });
    const freeSlots = [];
    if (!considerStartEndTime) {
      start = start.startOf("day");
      end = end.endOf("day");
    }
    while (start <= end) {
      const day = start.weekday - 1;
      if (timeConstraints[day].length > 0) {
        const startConstraint = context.combine(start, timeConstraints[day][0]);
        const endConstraint = context.combine(start, timeConstraints[day][1]);
        if (!considerStartEndTime) {
          freeSlots.push([startConstraint, endConstraint]);
        } else if (endConstraint > start) {
          freeSlots.push([
            DateTime.max(startConstraint, start),
            DateTime.min(endConstraint, end),
          ]);
        }
      }
      start = start.startOf("day");
      start = start.plus(oneDay);
    }
    return freeSlots;
  },

  /**
   * manager function that calls other functions to make a scheduling decision
   *
   * @param { Array } freeTimes is the free time slots of all users
   * @param { Duration } duration is the duration of the event
   * @param { Array } historyFreqs is the histograms for all users
   * @param {number} category is the type of event (work/leisure)
   * @param {DateTime} startDate is the start of the search range
   * @return {null|{start: string, end: string}} returns a time slot
   */
  findMeetingSlot(freeTimes, duration, historyFreqs, category, startDate) {
    if (!freeTimes || freeTimes.length === 0) {
      console.error("findMeetingSlot Error: No Free Time Given");
      return null;
    }
    const timeSlots = context._schedule(freeTimes, duration);
    const choice = context._chooseFromHistory(
      timeSlots,
      historyFreqs,
      duration,
      category,
      startDate
    );
    if (choice) {
      return {
        start: choice.toISO(),
        end: choice.plus(duration).toISO(),
      };
    }
    return null;
  },

  /**
   * labels the user's last 30 days of calendar events
   *
   * @param {Array} lastMonthBusySchedule is the user's last month of calendar events
   * @return {Promise} returns the user's labeled calendar history
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
   * Generates the initial bias added to the histogram
   *
   * @param {number} category is the type of event (work/leisure)
   * @return {any[]} initial bias
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
    if (category > 1) {
      // workdays are less popular
      for (let i = 0; i < 7; i++) {
        const vals = Array(halfHoursInDay).fill(0);
        for (let i = 0; i <= 12; i++) vals[i] = -5;
        for (let i = 13; i < 15; i++) vals[i] = i - 14;
        for (let i = 15; i <= 16; i++) vals[i] = 1;
        for (let i = 17; i <= 18; i++) vals[i] = 17 - i;
        for (let i = 19; i < 24; i++) vals[i] = -5;
        for (let i = 24; i < 26; i++) vals[i] = i - 25;
        for (let i = 26; i <= 27; i++) vals[i] = 1;
        for (let i = 28; i <= 29; i++) vals[i] = 28 - i;
        for (let i = 31; i < 36; i++) vals[i] = -5;
        for (let i = 36; i < 38; i++) vals[i] = i - 37;
        for (let i = 38; i <= 39; i++) vals[i] = 1;
        for (let i = 40; i <= 41; i++) vals[i] = 40 - i;
        for (let i = 42; i < 48; i++) vals[i] = -5;
        frequencies[i] = vals;
      }
    }
    return frequencies;
  },

  /**
   * Generates the user's histogram
   *
   * @param { Array } categorisedSchedule given in the format:
   * [{startTime: ISO String, endTime: ISO String}]
   * @param { number } category is the type (work/leisure)
   * @return { Array } frequencies for each half hour time slot for this user
   */
  async generateUserHistory(categorisedSchedule, category) {
    let frequencies = this.initialiseHistFreqs(category);
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
    frequencies = frequencies.map((arr) =>
      arr.map((a) => (a + Math.abs(smallest)) / (largest - smallest))
    );
    return frequencies;
  },
};

module.exports = context;
