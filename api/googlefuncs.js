var google = require( 'googleapis' );
var calendar = google.calendar( 'v3' );
var OAuth2 = google.auth.OAuth2;


module.exports = {

    createMeeting( tokens, title, startDateTime, endDateTime ) {
        oauth2Client.setCredentials( tokens );
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

    /*getMeetings( tokens, startDateTime, endDateTime ) {
        oauth2Client.setCredentials( tokens );
        return new Promise( function( resolve, reject ) {
            response = service.freebusy().query(body=body).execute()
            calendar.events.list({
                auth: oauth2Client,
                calendarId: 'primary',
                orderBy: 'startTime',
                timeMin: ( new Date() ).toISOString(),
                timeMax: new Date( sevenBusinessDaysAhead ).toISOString(),
                singleEvents: true

            }, function( calendarError, calendarResponse ) {
                if( calendarError ) { reject( calendarError ); return }
                resolve( calendarResponse );
            });
        });
    }*/
}