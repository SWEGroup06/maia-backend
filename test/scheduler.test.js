import luxon from 'luxon';
const { DateTime, Duration } = luxon;
const s = require('../src/scheduler');

const DAY1 = DateTime.local(2020, 10, 14);
const DAY2 = DateTime.local(2020, 10, 15);

console.log("helo");
function get_dt(date, hour, minutes, duration_hrs, duration_mins = 0) {
  const start = s.combine(date, DateTime.fromObject({hour: hour, minute: minutes}));
  const end = start.plus({hours: duration_hrs, minutes: duration_mins});
  return [start, end]
}

function get_dt_google_format(date, hour, minutes, duration_hrs, duration_mins) {
  const ds = get_dt(date, hour, minutes, duration_hrs, duration_mins);
  return {'start': ds[0], 'end': ds[1]}
}

const FREE_DATETIME1 = [0,1,2,3,4].map(x => get_dt(DAY1, 9 + 3 * x, 0, 1));
const FREE_DATETIME2 = [0,1,2,3].map(x => get_dt(DAY1, 9 + 4 * x, 0, 1));

const FREE_DATETIME3 = [get_dt(DAY1, 9, 0, 30),
  get_dt(DAY1, 15, 6, 30)];

const FREE_DATETIME4 = FREE_DATETIME1 + FREE_DATETIME1.forEach(se => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s,e]
});

const FREE_DATETIME5 = FREE_DATETIME2.forEach(se => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s,e]
});
const FREE_DATETIME6 = FREE_DATETIME3 +
                 [get_dt(DAY2, 10, 0, 0, 30),
                   get_dt(DAY2, 15, 0,6,30)];

const BUSY_DATETIME1 = [0,1,2,3,4].forEach(x => get_dt_google_format(DAY1, 10 + 3 * x, 0, 2,0));

const WORKING_HOURS = [[DateTime.fromObject({hour: 8, minute: 30}), DateTime.fromObject({hour: 19})]] * 5 + [[]] * 2;
const WORKING_HOURS_FORMATTED = [[s.combine(DAY1, DateTime.fromObject({hour: 8, minute: 30})), s.combine(DAY1, DateTime.fromObject({hour: 19}))],
  [s.combine(DAY2, DateTime.fromObject({hour: 8, minute: 30})), s.combine(DAY2, DateTime.fromObject({hour: 19}))]];

const DURATION = Duration.fromObject({minutes: 30});


const output_times = s.schedule([FREE_DATETIME1, FREE_DATETIME2], DURATION);
const expected_times = [get_dt(DAY1,9,0, 1), get_dt(DAY1, 21,0,1)];
console.log(output_times, expected_times);
console.log(output_times.map(xx => [xx[0].hour, xx[0].minute, xx[1].hour, xx[1].minute, xx[0].day]));
console.log("done");

// test('finds non-empty intersection in two schedules', () => {
//   const output_times = s.schedule([FREE_DATETIME1, FREE_DATETIME2], DURATION)
//   const expected_times = [get_dt(DAY1,9,0, 1), get_dt(DAY1, 21,0,1)];
//   expect(output_times).toEqual(expected_times);
//   expect(s.add(2,2)).toBe(4);
// });

