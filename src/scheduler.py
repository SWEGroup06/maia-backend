"""
Module defining Scheduler class
"""

from datetime import datetime, timedelta


class Scheduler:
    @staticmethod
    def intersects(range1, range2, duration):
        # if they intersect for required duration: return range of times intersection can start
        # else return None
        new_range = (
            max(range1[0], range2[0]),
            min(range1[1], range2[1])
        )
        return new_range if new_range[0] + duration <= new_range[1] else None

    # everyones_free_datetimes is a list of (start_free_datetime, end_free_datetime)
    # pre-conditions:
    #  everyones_free_datetimes contains all times between possible start datetime and end datetime
    #  of meeting
    def schedule(self, everyones_free_datetimes: [[(datetime, datetime)]],
                 # everyones_maybe_datetimes:  [(datetime, int)],
                 duration_of_event: timedelta,
                 # work_time_start: time,
                 # work_time_end: time
                 ) -> [(datetime, datetime)]:
        """
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
