"""
Module defining Scheduler class
"""

from datetime import datetime, timedelta, time, date

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

    @staticmethod
    def get_constraints(working_hours: [(time, time)],
                        start: date,
                        end: date) -> [(datetime, datetime)]:
        """
        Takes in weekly working hours and transforms to schedule of working datetimes
        :param working_hours:
        :param start:
        :param end: inclusive
        :return:
        """
        i = start.weekday()
        ans = []
        while start != end:
            if len(working_hours[i]) >= 2:
                ans.append((datetime.combine(start, working_hours[i][0]),
                            datetime.combine(start, working_hours[i][1])))
            start += timedelta(days=1)
            i += 1
            i %= 7
        if len(working_hours[i]) >= 2:
            ans.append((datetime.combine(start, working_hours[i][0]),
                        datetime.combine(start, working_hours[i][1])))
        return ans

    @staticmethod
    def busy_to_free(schedule: [tuple], start: datetime, end: datetime) -> [(datetime, datetime)]:
        """
        This function converts schedules of busy times into a schedule of free times.
        :param schedule: someone's schedule. The events are sorted by time.
        :param start: The first time the event can be scheduled in
        :param end: The time by which the event must be completed
        :return: a schedule of free periods for all busy schedules given
        """
        begin = start
        curr_free_times = []
        for busy_time in schedule:
            if busy_time['end'] > end:
                break
            if begin < busy_time['start']:
                curr_free_times.append((begin, busy_time['start']))
                begin = busy_time['end']
        if begin < end:
            curr_free_times.append((begin, end))
        return curr_free_times

    def schedule(self, schedules: [[(datetime, datetime)]],
                 # everyones_maybe_datetimes:  [(datetime, int)],
                 duration: timedelta,
                 constraints: [[(datetime, datetime)]],
                 ) -> [(datetime, datetime)]:
        """
        schedules is a list of (start_free_datetime, end_free_datetime)
        pre-conditions:
        schedules contains all times between possible start datetime and end datetime
        of meeting
        :param schedules: list containing everyone's free schedules
        :param duration: duration of event to be booked
        :return: ranges for all possible start date times of the event (gives range of every
        possible time event could start at)
        """

        schedules += constraints
        ans = schedules[0]
        for schedule in schedules[1:]:
            temp = []
            i = 0
            j = 0
            while i < len(ans) and j < len(schedule):
                intersect = self.intersects(
                    ans[i], schedule[j], duration)
                if intersect is not None:
                    temp.append(intersect)
                # increment pointer for free list item that ends first, keeps the other the same
                if ans[i][1] < schedule[j][1]:
                    i += 1
                else:
                    j += 1
            ans = temp
        # convert list of free time slots to list of ranges of start date times
        # e.g for duration = 1hr, ans = [((2020, 10, 14, 9), (2020, 10, 14, 11))] -> ->
        #  [((2020, 10, 14, 9), (2020, 10, 14, 10))]
        #     since can start anytime between 9am and 10am for a 1hr meeting
        ans = [(start, end - duration)
               for (start, end) in ans]

        return ans


# work time: 9 - 19
# duration: 30 mins
# mutually free times: [(8, 8:30),(9:12, 9:42)]
# shown free times: [(8,8:30)]

# def jsonify(schedules):
#     j = []
#     for schedule in schedules:
#         x = []
#         for (start, end) in schedule:
#             x.append({"end": end, "start": start})
#         j.append(x)
#     return j
