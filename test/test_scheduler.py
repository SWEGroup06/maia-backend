from unittest import TestCase
from src import scheduler
from datetime import datetime, timedelta, time

free_datetimes1 = [(datetime(2020, 10, 14, 9 + 3 * x), datetime(2020, 10, 14, 10 + 3 * x)) for x in range(5)]
free_datetimes2 = [(datetime(2020, 10, 14, 9 + 4 * x), datetime(2020, 10, 14, 10 + 4 * x)) for x in range(4)]

free_datetimes3 = [(datetime(2020, 10, 14, 10), datetime(2020, 10, 14, 12)),
                   (datetime(2020, 10, 14, 15), datetime(2020, 10, 14, 20)),
                   (datetime(2020, 10, 14, 21), datetime(2020, 10, 14, 22, 30))]
free_datetimes4 = [(datetime(2020, 10, 14, 9), datetime(2020, 10, 14, 12)),
                   (datetime(2020, 10, 14, 12, 30), datetime(2020, 10, 14, 13)),
                   (datetime(2020, 10, 14, 20), datetime(2020, 10, 14, 21))]

all_free_datetimes = [free_datetimes3, free_datetimes4]

duration = timedelta(minutes=30)

datetime(2020, 10, 14, 9 + 3)


class TestScheduler(TestCase):
    def test_intersects(self):
        # self.fail()
        s = scheduler.Scheduler()
        print(s.schedule(all_free_datetimes, duration))
        pass

    def test_schedule(self):
        # self.fail()
        pass
