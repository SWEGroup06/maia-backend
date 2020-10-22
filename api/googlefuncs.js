var google = require( 'googleapis' );
var calendar = google.calendar( 'v3' );
var OAuth2 = google.auth.OAuth2;


module.exports = {

    createMeeting( tokens, title, startDateTime, endDateTime ) {
        oauth2Client.setCredentials( tokens ); //oauth2Client not defined here yet
        return new Promise( function( resolve, reject ) {
            calendar.events.insert({
                auth: oauth2Client,
                calendarId: 'primary',
                resource: {
                    summary: title,
                    start: { dateTime: startDateTime },
                    end: { dateTime: endDateTime }
                }
            }, function( calendarError, calendarResponse ) {
                if( calendarError ) { reject( calendarError ); return }
                resolve( calendarResponse );
            });
        });
    },

    getBusySchedule( tokens, startDateTime, endDateTime ) {
        oauth2Client.setCredentials( tokens );
        return new Promise( function( resolve, reject ) {
            calendar.freebusy.query({
                auth: oauth2Client,
                resource: {items: [{"id" : 'primary'}],
                           timeMin: startDateTime,
                           timeMax: endDateTime
                          }
            }), function( calendarError, calendarResponse ) {
                if( calendarError ) { reject( calendarError ); return }
                var events = calendarResponse['calendars'];
                if (events.length == 0) {
                    console.log('No upcoming events found.');
                } else {
                    console.log('Found events');
                }
                resolve( calendarResponse['calendars'] );
            });
        });
    }
}