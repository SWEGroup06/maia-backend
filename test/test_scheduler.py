"""
Module defining test_scheduler
"""

from unittest import TestCase
from datetime import datetime, timedelta, date, time
from src import scheduler as sch


def get_dt(date1: date, time1: time, duration: timedelta) -> (datetime, datetime):
    datetime1 = datetime(date1.year, date1.month, date1.day, time1.hour, time1.minute)
    return datetime1, datetime1 + duration


DAY1 = date(2020, 10, 14)

FREE_DATETIME1 = [get_dt(DAY1, time(9 + 3 * x), timedelta(hours=1)) for x in range(5)]
FREE_DATETIME2 = [get_dt(DAY1, time(9 + 4 * x), timedelta(hours=1)) for x in range(4)]


FREE_DATETIME3 = [get_dt(DAY1, time(9), timedelta(minutes=30)),
                  get_dt(DAY1, time(15), timedelta(hours=6, minutes=30)),
                  (datetime(2020, 10, 14, 15), datetime(2020, 10, 14, 20)),
                  (datetime(2020, 10, 14, 21), datetime(2020, 10, 14, 22, 30))]
FREE_DATETIME4 = [(datetime(2020, 10, 14, 9), datetime(2020, 10, 14, 12)),
                  (datetime(2020, 10, 14, 12, 30), datetime(2020, 10, 14, 13)),
                  (datetime(2020, 10, 14, 20), datetime(2020, 10, 14, 21))]

DURATION = timedelta(minutes=30)


class TestScheduler(TestCase):
    def test_scheduler_only_returns_free_times(self):
        scheduler = sch.Scheduler()
        output_times = scheduler.schedule([FREE_DATETIME1, FREE_DATETIME2], DURATION)
        expected_times = [get_dt(DAY1, time(9), DURATION), get_dt(DAY1, time(21), DURATION)]
        self.assertTrue(set(output_times).issubset(expected_times))

    def test_scheduler_finds_intersection_of_two_schedules(self):
        scheduler = sch.Scheduler()
        output_times = scheduler.schedule([FREE_DATETIME1, FREE_DATETIME2], DURATION)
        expected_times = [get_dt(DAY1, time(9), DURATION), get_dt(DAY1, time(21), DURATION)]
        self.assertCountEqual(output_times, expected_times)

    def test_finds_intersection_in_three_schedules(self):
        pass

    def test_intersection_is_within_constraints(self):
        pass