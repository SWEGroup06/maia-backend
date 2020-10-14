"""
Module defining test_scheduler
"""

from unittest import TestCase
from datetime import datetime, timedelta
from src import scheduler as sch

FREE_DATETIME1 = [(datetime(2020, 10, 14, 9 + 3 * x), datetime(2020, 10, 14, 10 + 3 * x))
                  for x in range(5)]
FREE_DATETIME2 = [(datetime(2020, 10, 14, 9 + 4 * x), datetime(2020, 10, 14, 10 + 4 * x))
                  for x in range(4)]

FREE_DATETIME3 = [(datetime(2020, 10, 14, 10), datetime(2020, 10, 14, 12)),
                  (datetime(2020, 10, 14, 15), datetime(2020, 10, 14, 20)),
                  (datetime(2020, 10, 14, 21), datetime(2020, 10, 14, 22, 30))]
FREE_DATETIME4 = [(datetime(2020, 10, 14, 9), datetime(2020, 10, 14, 12)),
                  (datetime(2020, 10, 14, 12, 30), datetime(2020, 10, 14, 13)),
                  (datetime(2020, 10, 14, 20), datetime(2020, 10, 14, 21))]

ALL_FREE_DATETIMES = [FREE_DATETIME1, FREE_DATETIME2]

DURATION = timedelta(minutes=30)


class TestScheduler(TestCase):
    def test_intersects(self):
        # self.fail()
        scheduler = sch.Scheduler()
        print(scheduler.schedule(ALL_FREE_DATETIMES, DURATION))
        pass

    def test_schedule(self):
        # self.fail()
        pass
