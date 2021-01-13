require("dotenv").config();

const { DateTime, Duration } = require("luxon");
const { _schedule, getFreeSlots } = require("../src/scheduler");

const assert = require("assert");

const { describe, it } = require("mocha");

// wednesday
const DAY1 = DateTime.local(2020, 10, 14);
// thursday
const DAY2 = DateTime.local(2020, 10, 15);

combine = (date, hours, minutes = 0) => {
  return DateTime.fromObject({
    year: date.year,
    month: date.month,
    day: date.day,
    hour: hours,
    minute: minutes,
  });
};

getDt = (date, hour, minutes = 0, duration_hrs = 0, duration_mins = 0) => {
  const start = combine(date, hour, minutes);
  const end = start.plus({ hours: duration_hrs, minutes: duration_mins });
  return [start, end];
};

// 9-10, 12-13, 15-16, 18-19, 21-22 DAY 1
const FREE_DATETIME1 = [0, 1, 2, 3, 4].map((x) => getDt(DAY1, 9 + 3 * x, 0, 1));
// 9-10, 13-14, 17-18, 21-22 DAY 2
const FREE_DATETIME2 = [0, 1, 2, 3].map((x) => getDt(DAY1, 9 + 4 * x, 0, 1));
const FREE_DATETIME3 = [getDt(DAY1, 9, 0, 0, 30), getDt(DAY1, 15, 0, 6, 30)];

const FREE_DATETIME4 = FREE_DATETIME1.concat(
  FREE_DATETIME1.map((se) => {
    const s = se[0].plus({ days: 1 });
    const e = se[1].plus({ days: 1 });
    return [s, e];
  })
);

const FREE_DATETIME5 = FREE_DATETIME2.map((se) => {
  const s = se[0].plus({ days: 1 });
  const e = se[1].plus({ days: 1 });
  return [s, e];
});
const FREE_DATETIME6 = FREE_DATETIME3.concat([
  getDt(DAY2, 10, 0, 0, 30),
  getDt(DAY2, 15, 0, 6, 30),
]);

const BUSY_DATETIME1 = [0, 1, 2, 3, 4].map((x) =>
  getDt(DAY1, 10 + 3 * x, 0, 2, 0)
);

// const WORKING_HOURS =
//     [0, 1, 2, 3, 4].map((x) =>
//       ({startTime: DateTime.fromObject({hour: 8, minute: 30}).toISO(),
//         endTime: DateTime.fromObject({hour: 19}).toISO()})).concat([[], []]);

// const WORKING_HOURS_FORMATTED = [
//   getDt(DAY1, 8, 30, 10, 30),
//   getDt(DAY2, 8, 30, 10, 30),
// ];

const HOUR1 = Duration.fromObject({ hours: 1 });
const HALFHOUR = Duration.fromObject({ minutes: 30 });
const TODAY = DateTime.local();

const fullDay = [
  {
    startTime: TODAY.startOf("day").toISO(),
    endTime: TODAY.endOf("day").toISO(),
  },
];
const noWorkingHours = [
  fullDay,
  fullDay,
  fullDay,
  fullDay,
  fullDay,
  fullDay,
  fullDay,
];
describe("Testing the scheduling algorithm", function () {
  it("finds non-empty intersection in two schedules", () => {
    const outputTimes = _schedule([FREE_DATETIME1, FREE_DATETIME2], HOUR1);
    const expectedTimes = [getDt(DAY1, 9, 0, 0), getDt(DAY1, 21, 0, 0)];
    assert.deepStrictEqual(outputTimes, expectedTimes);
  });

  it("finds non-empty intersection in three schedules", () => {
    const outputTimes = _schedule(
      [FREE_DATETIME1, FREE_DATETIME2, FREE_DATETIME3],
      HALFHOUR
    );
    const expectedTimes = [getDt(DAY1, 9, 0, 0), getDt(DAY1, 21, 0, 0)];
    assert.deepStrictEqual(outputTimes, expectedTimes);
  });

  it("finds intersection over two-days", () => {
    const outputTimes = _schedule(
      [FREE_DATETIME4, FREE_DATETIME5, FREE_DATETIME6],
      HALFHOUR
    );
    const expectedTimes = [getDt(DAY2, 21)];
    assert.deepStrictEqual(outputTimes, expectedTimes);
  });

  it("transforms schedule of busy events to free times", async () => {
    const se = getDt(DAY1, 9, 0, 13);
    const freeTime = await getFreeSlots(
      BUSY_DATETIME1,
      se[0],
      se[1],
      Duration.fromObject({ minutes: 0 }),
      noWorkingHours
    );
    for (let i = 0; i < FREE_DATETIME1.length; i++) {
      assert.deepStrictEqual(freeTime[i].c, FREE_DATETIME1[i].c);
    }
  });
});
