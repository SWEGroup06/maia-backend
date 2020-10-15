"""
Module defining Scheduler class
"""

from datetime import datetime, timedelta


class Scheduler:
    """
    class for scheduling algorithm
    """

    @staticmethod
    def intersects(range1, range2, duration):
        """
        returns intersection between two date time ranges
        :param range1: free date time period
        :param range2: another free date time period
        :param duration: size of intersection sufficient to contain meeting
        :return: if they intersect for required duration: return range of times intersection
                 can start
                 else return None
        """

        new_range = (
            max(range1[0], range2[0]),
            min(range1[1], range2[1])
        )
        return new_range if new_range[0] + duration <= new_range[1] else None

    def schedule(self, everyones_free_datetimes: [[(datetime, datetime)]],
                 # everyones_maybe_datetimes:  [(datetime, int)],
                 duration_of_event: timedelta
                 ) -> [(datetime, datetime)]:
        """
        everyones_free_datetimes is a list of (start_free_datetime, end_free_datetime)
        pre-conditions:
        everyones_free_datetimes contains all times between possible start datetime and end datetime
        of meeting
        :param everyones_free_datetimes:
        :param duration_of_event:
        :return: ranges for all possible start date times of the event (gives range of every
        possible time event could start at)
        """
        ans = everyones_free_datetimes[0]
        for person_frees in everyones_free_datetimes[1:]:
            temp = []
            i = 0
            j = 0
            while i < len(ans) and j < len(person_frees):
                intersect = self.intersects(ans[i], person_frees[j], duration_of_event)
                if intersect is not None:
                    temp.append(intersect)
                # increment pointer for free list item that ends first, keeps the other the same
                if ans[i][1] < person_frees[j][1]:
                    i += 1
                else:
                    j += 1
            ans = temp
        # convert list of free time slots to list of ranges of start date times
        # e.g for duration = 1hr, ans = [((2020, 10, 14, 9), (2020, 10, 14, 11))] -> ->
        #  [((2020, 10, 14, 9), (2020, 10, 14, 10))]
        #     since can start anytime between 9am and 10am for a 1hr meeting
        ans = [(start_datetime, end_datetime - duration_of_event)
               for (start_datetime, end_datetime) in ans]

        return ans

    @staticmethod
    def busy_to_free(schedules: [[tuple]], start_datetime: datetime, end_datetime: datetime) \
            -> [[(datetime, datetime)]]:
        """
        This function converts schedules of busy times into a schedule of free times.
        :param schedules: schedules of the people in the team. The events are sorted by time.
        :param start_datetime: The first time the event can be scheduled in
        :param end_datetime: The time by which the event must be completed
        :return: a list of lists of free periods for the givens schedules
        """
        ans = []
        for schedule in schedules:
            begin = start_datetime
            curr_free_times = []
            for busy_time in schedule:
                if busy_time['end'] > end_datetime:
                    break
                if begin < busy_time['start']:
                    curr_free_times.append((begin, busy_time['start']))
                    begin = busy_time['end']
            if begin < end_datetime:
                curr_free_times.append((begin, end_datetime))
            ans.append(curr_free_times)

        return ans
