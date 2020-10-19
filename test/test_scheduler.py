"""
Module defining test_scheduler
"""

from unittest import TestCase
from datetime import datetime, timedelta, date, time
from src import scheduler as sch


def get_dt(date1: date, time1: time, duration: timedelta) -> (datetime, datetime):
  """
  formats a datetime tuple to contain the start and end of a period given the start date and time
   and the event's duration
  :param date1: start date
  :param time1: start time
  :param duration: duration of event
  :return: (start datetime, end datetime) for given event
  """
  datetime1 = datetime.combine(date1, time1)
  return datetime1, datetime1 + duration


def get_dt_google_format(date1: date, time1: time, duration: timedelta) -> (datetime, datetime):
  """
  formats a datetime tuple inline with the google API's response body for a busy time
  :param date1: start date
  :param time1: start time
  :param duration: duration of event
  :return: {'start': start date time, 'end': end date time} for a given event
  """
  datetime1 = datetime.combine(date1, time1)
  return {'start': datetime1, 'end': datetime1 + duration}


DAY1 = date(2020, 10, 14)
DAY2 = date(2020, 10, 15)


FREE_DATETIME1 = [get_dt(DAY1, time(9 + 3 * x), timedelta(hours=1))
                  for x in range(5)]
FREE_DATETIME2 = [get_dt(DAY1, time(9 + 4 * x), timedelta(hours=1))
                  for x in range(4)]
FREE_DATETIME3 = [get_dt(DAY1, time(9), timedelta(minutes=30)),
                  get_dt(DAY1, time(15), timedelta(hours=6, minutes=30))]

FREE_DATETIME4 = FREE_DATETIME1 + \
                 [get_dt(DAY2, time(9 + 3 * x), timedelta(hours=1)) for x in range(5)]
FREE_DATETIME5 = [get_dt(DAY2, time(9 + 4 * x), timedelta(hours=1))
                  for x in range(4)]
FREE_DATETIME6 = FREE_DATETIME3 + \
                 [get_dt(DAY2, time(10), timedelta(minutes=30)),
                  get_dt(DAY2, time(15), timedelta(hours=6, minutes=30))]

BUSY_DATETIME1 = [get_dt_google_format(DAY1, time(10 + 3 * x), timedelta(hours=2))
                  for x in range(5)]

WORKING_HOURS = [(time(8,30),time(19))]*5 + [()]*2
WORKING_HOURS_FORMATTED = [(datetime.combine(DAY1, time(8,30)),datetime.combine(DAY1, time(19))),
   (datetime.combine(DAY2, time(8,30)), datetime.combine(DAY2,time(19)))]

DURATION = timedelta(minutes=30)

SCHEDULER = sch.Scheduler()


class TestScheduler(TestCase):
  """
  test suite for Scheduler
  """

  def test_finds_intersection_in_two_schedules(self):
    """
    Finds the intersection of free times in two people's schedules
    :return:
    """
    output_times = SCHEDULER.schedule(
      [FREE_DATETIME1, FREE_DATETIME2], DURATION)
    expected_times = [get_dt(DAY1, time(9), DURATION),
                      get_dt(DAY1, time(21), DURATION)]
    self.assertCountEqual(output_times, expected_times)

  def test_finds_intersection_in_three_schedules(self):
    """
    Finds the intersection of free times in three people's schedules
    :return:
    """
    output_times = SCHEDULER.schedule([FREE_DATETIME1, FREE_DATETIME2, FREE_DATETIME3],
                                      DURATION)
    expected_times = [get_dt(DAY1, time(9), timedelta(
      0)), get_dt(DAY1, time(21), timedelta(0))]
    self.assertCountEqual(output_times, expected_times)

  def test_finds_intersection_over_multiple_days(self):
    """
    Finds the intersection of free times in three people's schedules
    :return:
    """
    output_times = SCHEDULER.schedule([FREE_DATETIME4, FREE_DATETIME5, FREE_DATETIME6],
                                      DURATION)
    expected_times = [get_dt(DAY2, time(21), timedelta(0))]
    self.assertCountEqual(output_times, expected_times)

  def test_transforms_busy_schedule_to_free(self):
    """
    busy_to_free() converts a list of busy schedules to free schedules
    :return: list of free schedules
    """
    start_datetime, end_datetime = get_dt(
      DAY1, time(9), timedelta(hours=13))
    free_times = SCHEDULER.busy_to_free(
      BUSY_DATETIME1, start_datetime, end_datetime)
    self.assertCountEqual(free_times, FREE_DATETIME1)

  def test_transforms_constraints_to_time_slots(self):
    expected_constraints = WORKING_HOURS_FORMATTED
    output_constraints = SCHEDULER.get_constraints(WORKING_HOURS, DAY1, DAY2)
    self.assertCountEqual(expected_constraints, output_constraints)

  def test_scheduler_handles_constraints(self):
    expected_schedules = [get_dt(DAY1,time(9),DURATION)]
    output_schedules = SCHEDULER.schedule([FREE_DATETIME1, FREE_DATETIME2],
                       DURATION,
                       [WORKING_HOURS_FORMATTED])
    self.assertCountEqual(expected_schedules, output_schedules)