const { DateTime, Duration } = require('luxon');
const { schedule, busy_to_free, generate_constraints, choose } = require('../src/scheduler');

const DAY1 = DateTime.local(2020, 10, 14);
const DAY2 = DateTime.local(2020, 10, 15);

function combine(date, hours, minutes=0) {
  return DateTime.fromObject({year: date.year, month: date.month, day: date.day,
                              hour: hours, minute: minutes});
}

function get_dt(date, hour, minutes=0, duration_hrs=0, duration_mins=0) {
  const start = combine(date, hour, minutes);
  const end = start.plus({hours: duration_hrs, minutes: duration_mins});
  return [start, end]
}

const FREE_DATETIME1 = [0,1,2,3,4].map(x => get_dt(DAY1, 9 + 3 * x, 0, 1));
const FREE_DATETIME2 = [0,1,2,3].map(x => get_dt(DAY1, 9 + 4 * x, 0, 1));
const FREE_DATETIME3 = [get_dt(DAY1, 9, 0, 0, 30), get_dt(DAY1, 15, 0, 6, 30)];

const FREE_DATETIME4 = FREE_DATETIME1.concat(FREE_DATETIME1.map(se => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s,e];
}));

const FREE_DATETIME5 = FREE_DATETIME2.map(se => {
  const s = se[0].plus({days: 1});
  const e = se[1].plus({days: 1});
  return [s,e];
});
const FREE_DATETIME6 = FREE_DATETIME3.concat([get_dt(DAY2,10,0,0,30), get_dt(DAY2,15,0,6,30)]);

const BUSY_DATETIME1 = [0,1,2,3,4].map(x => get_dt(DAY1, 10 + 3 * x, 0, 2,0));

const WORKING_HOURS =
  [0,1,2,3,4].map(x => [DateTime.fromObject({hour: 8, minute: 30}), DateTime.fromObject({hour: 19})])
             .concat([[],[]]);

const WORKING_HOURS_FORMATTED = [get_dt(DAY1, 8, 30, 10, 30),
                                 get_dt(DAY2, 8, 30, 10, 30)];

const HOUR1 = Duration.fromObject({hours: 1});
const HALFHOUR = Duration.fromObject({minutes: 30});


test('finds non-empty intersection in two schedules', () => {
  const output_times = schedule([FREE_DATETIME1, FREE_DATETIME2], HOUR1);
  const expected_times = [get_dt(DAY1,9,0, 0), get_dt(DAY1, 21,0,0)];
  expect(output_times).toEqual(expected_times);
});

test('finds non-empty intersection in three schedules', () => {
  const output_times
      = schedule([FREE_DATETIME1, FREE_DATETIME2, FREE_DATETIME3], HALFHOUR);
  const expected_times = [get_dt(DAY1,9,0,0), get_dt(DAY1,21,0,0)];
  expect(output_times).toEqual(expected_times);
});

test('finds intersection over two-days', () => {
  const output_times
      = schedule([FREE_DATETIME4, FREE_DATETIME5, FREE_DATETIME6], HALFHOUR);
  const expected_times = [get_dt(DAY2, 21)];
  expect(output_times).toEqual(expected_times);
});

test('transforms schedule of busy events to free times', () => {
  const se = get_dt(DAY1, 9, 0, 13);
  const free_time = busy_to_free(BUSY_DATETIME1, se[0], se[1]);
  expect(free_time).toEqual(FREE_DATETIME1);
});

test('transforms constraints to time slots', () => {
  expected_constraints = WORKING_HOURS_FORMATTED;
  output_constraints = generate_constraints(WORKING_HOURS, DAY1, DAY2);
  expect(output_constraints).toEqual(expected_constraints);
});

test('scheduler uses constraints', () => {
  expected_schedules = [get_dt(DAY1, 9, 0, 0, 30)];
  output_schedules
    = schedule([FREE_DATETIME1, FREE_DATETIME2], HALFHOUR, [WORKING_HOURS_FORMATTED]);
  expect(output_schedules).toEqual(expected_schedules);
});

test('chooses the shortest duration', () => {
  choices = [get_dt(DAY1, 9, 0, 2), get_dt(DAY1, 13, 0, 1)];
  expected_choice = combine(DAY1, 13);
  output_choice = choose(choices);
  expect(output_choice).toEqual(expected_choice);
})