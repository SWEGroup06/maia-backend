from __future__ import print_function
import datetime
import pickle
import os.path
import scheduler
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/calendar.readonly']


def main():
    """Shows basic usage of the Google Calendar API.
        Prints the start and name of the next 10 events on the user's calendar.
        """
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first
    # time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    service = build('calendar', 'v3', credentials=creds)
    
    # Call the Calendar API
    events = getEvents(service)
    if not events:
        print('No upcoming events found.')
    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        print(start, event['summary'])

    
    timeMin = datetime.datetime.utcnow().isoformat() + 'Z' # 'Z' indicates UTC time
    timeMax = datetime.datetime(2020, 10, 18, 3).isoformat() + 'Z'
    print(timeMin)
    print(timeMax)
    print('######################')
    getFreeBusy(service, timeMin, timeMax)



def getEvents(service):
    now = datetime.datetime.utcnow().isoformat() + 'Z' # 'Z' indicates UTC time
    print('Getting the upcoming 10 events')
    events_result = service.events().list(calendarId='primary', timeMin=now,
                                          maxResults=10, singleEvents=True,
                                          orderBy='startTime').execute()
    events = events_result.get('items', [])
    return events

def getFreeBusyForSingleCalendar(service, timeMin, timeMax):
    #body might have to be created by bot
    body = {
        "timeMin": timeMin,
            "timeMax": timeMax,
            "items": [
                      {
                      "id": 'primary'
                
                      }
                      ]
    }
    response = service.freebusy().query(body=body).execute()
    busy_data = response['calendars']['primary']['busy']
    return busy_data

def getFreeBusyForAllCalendars(service, timeMin, timeMax, calendars):
    return [getFreeBusyForSingleCalendar(x, timeMin, timeMax) for x in calendars]



def createEvent(service, event):
    event = service.events().insert(calendarId='primary', body=event).execute()
    print('Event created: %s' % (event.get('htmlLink')))


if __name__ == '__main__':
    main()

