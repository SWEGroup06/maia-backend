from datetime import datetime, timedelta, time


class Scheduler:
    @staticmethod
    def intersects(range1, range2, duration):
        # if they intersect: return intersection
        # else return None
        new_range = (
            max(range1[0], range2[0]),
            min(range1[1], range2[1])
        )
        return new_range if new_range[0] + duration <= new_range[1] else None

    # free_times is a list of (start_free_time, duration_of_free_time)
    # pre-conditions:
    #  - everyones_free_times contains all times between possible start datetime and end datetime of meeting
    def schedule(self, everyones_free_datetimes: [(datetime, datetime)],
                 # everyones_maybe_datetimes:  [(datetime, int)],
                 duration_of_event: timedelta,
                 # work_time_start: time,
                 # work_time_end: time
                 ) -> datetime:
        ans = everyones_free_datetimes[0]
        for person_frees in everyones_free_datetimes[1:]:
            temp = []
            i = 0
            j = 0
            while i < len(ans) and j < len(person_frees):
                x = self.intersects(ans[i], person_frees[j], duration_of_event)
                if x != None:
                    temp.append(x)
                # increment pointer for free list item that ends first, keeps the other the same
                if ans[i][1] < person_frees[j][1]:
                    i += 1
                else:
                    j += 1
            ans = temp
        return ans
