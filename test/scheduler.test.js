const {DateTime, Duration} = require('luxon');
const {_schedule, getFreeSlots, generateConstraints, _choose, busyTimeFrequencies} = require('../src/scheduler');

// wednesday
const DAY1 = DateTime.local(2020, 10, 14);
// thursday
const DAY2 = DateTime.local(2020, 10, 15);

combine = (date, hours, minutes = 0) => {
  return DateTime.fromObject({
    year: date.year, month: date.month, day: date.day,
    hour: hours, minute: minutes});
};

getDt = (date, hour, minutes = 0, duration_hrs = 0, duration_mins = 0) => {
  const start = combine(date, hour, minutes);
  const end = start.plus({hours: duration_hrs, minutes: duration_mins});
  return [start, end];
};

const FREE_DATETIME1 = [0, 1, 2, 3, 4].map((x) => getDt(DAY1, 9 + 3 * x, 0, 1));
const FREE_DATETIME2 = [0, 1, 2, 3].map((x) => getDt(DAY1, 9 + 4 * x, 0, 1));
const FREE_DATETIME3 = [getDt(DAY1, 9, 0, 0, 30), getDt(DAY1, 15, 0, 6, 30)];

const FREE_DATETIME4 = FREE_DATETIME1.concat(FREE_DATETIME1.map((se) => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s, e];
}));

const FREE_DATETIME5 = FREE_DATETIME2.map((se) => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s, e];
});
const FREE_DATETIME6 = FREE_DATETIME3.concat(
    [getDt(DAY2, 10, 0, 0, 30), getDt(DAY2, 15, 0, 6, 30)]);

const BUSY_DATETIME1 = [0, 1, 2, 3, 4].map(
    (x) => getDt(DAY1, 10 + 3 * x, 0, 2, 0));

const WORKING_HOURS =
    [0, 1, 2, 3, 4].map((x) =>
      ({startTime: DateTime.fromObject({hour: 8, minute: 30}).toISO(),
        endTime: DateTime.fromObject({hour: 19}).toISO()})).concat([[], []]);

const WORKING_HOURS_FORMATTED = [getDt(DAY1, 8, 30, 10, 30),
  getDt(DAY2, 8, 30, 10, 30)];

const HOUR1 = Duration.fromObject({hours: 1});
const HALFHOUR = Duration.fromObject({minutes: 30});

test('finds non-empty intersection in two schedules', () => {
  const outputTimes = _schedule([FREE_DATETIME1, FREE_DATETIME2], HOUR1);
  const expectedTimes = [getDt(DAY1, 9, 0, 0), getDt(DAY1, 21, 0, 0)];
  expect(outputTimes).toEqual(expectedTimes);
});

test('finds non-empty intersection in three schedules', () => {
  const outputTimes = _schedule([FREE_DATETIME1, FREE_DATETIME2, FREE_DATETIME3], HALFHOUR);
  const expectedTimes = [getDt(DAY1, 9, 0, 0), getDt(DAY1, 21, 0, 0)];
  expect(outputTimes).toEqual(expectedTimes);
});

test('finds intersection over two-days', () => {
  const outputTimes = _schedule([FREE_DATETIME4, FREE_DATETIME5, FREE_DATETIME6], HALFHOUR);
  const expectedTimes = [getDt(DAY2, 21)];
  expect(outputTimes).toEqual(expectedTimes);
});

test('transforms schedule of busy events to free times', () => {
  const se = getDt(DAY1, 9, 0, 13);
  const freeTime = getFreeSlots(BUSY_DATETIME1, se[0], se[1]);
  expect(freeTime).toEqual(FREE_DATETIME1);
});

test('transforms constraints to time slots', () => {
  const expectedConstraints = WORKING_HOURS_FORMATTED;
  const outputConstraints = generateConstraints(WORKING_HOURS, DAY1.toISO(), DAY2.toISO());
  expect(outputConstraints).toEqual(expectedConstraints);
});

test('scheduler uses constraints', () => {
  const expectedSchedules = [getDt(DAY1, 9, 0, 0, 30)];
  const outputSchedules = _schedule([FREE_DATETIME1, FREE_DATETIME2], HALFHOUR, [WORKING_HOURS_FORMATTED]);
  expect(outputSchedules).toEqual(expectedSchedules);
});

test('chooses the shortest duration', () => {
  const choices = [getDt(DAY1, 9, 0, 2), getDt(DAY1, 13, 0, 1)];
  const expectedChoice = combine(DAY1, 13);
  const outputChoice = _choose(choices);
  expect(outputChoice).toEqual(expectedChoice);
});

test('gets busy times frequencies', () => {
  const schedule = [{start: '2020-11-03T17:14:00.000Z',
    end: '2020-11-03T19:30:00.000Z'},
  {start: '2020-11-04T17:14:00.000Z',
    end: '2020-11-04T19:30:00.000Z'},
  {start: '2020-11-05T17:14:00.000Z',
    end: '2020-11-06T19:30:00.000Z'},
  ];
  const halfHoursInDay = 24 * 2;
  const days = 7;
  const expectedFreqs = Array(days).fill(Array(halfHoursInDay).fill(0));
  for (let i = 34; i < 40; i++) {
    expectedFreqs[1][i]++;
    expectedFreqs[2][i]++;
    expectedFreqs[3][i]++;
  }
  for (let i = 40; i < 48; i++) {
    expectedFreqs[3][i]++;
  }
  for (let i = 0; i < 40; i++) {
    expectedFreqs[4][i]++;
  }
  const frequencies = busyTimeFrequencies(schedule);
  expect(frequencies).toEqual(expectedFreqs);
});
