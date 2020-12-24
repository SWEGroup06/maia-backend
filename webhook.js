// // Load environment variables
// require('dotenv').config();

// const STOP = process.argv.includes('--stop') || false;

// const fetch = require('node-fetch');
// const uuid = require('uuid');
// const fs = require('fs');
// const path = require('path');

// const token = {"access_token":"ya29.a0AfH6SMBZzeu3HqXtOqlBWCYscDf_9UrTK8n06JKUZsiVcQEM3qI6T1V-cS_hCl1OrOggd-GLg7eZWt7Z7BOtr7o0t5xmsrEceSD7Rd6IWWMhOHZ7os9kuafM3qMP1dwwiZVEv-pncIuADVZ7C5GQAP0qAL14KYOxfBHM5WgR1Zg","refresh_token":"1//07HLlGExgZhLfCgYIARAAGAcSNwF-L9IrTh_q09FeMnTrFU9vRikUsjBlFqvLf0dbFmZHeBdEg9-V2FAgy-3_Lm-CrBR3EfGtJiE","scope":"https://www.googleapis.com/auth/gmail.send openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.settings.basic","token_type":"Bearer","id_token":"eyJhbGciOiJSUzI1NiIsImtpZCI6IjZhZGMxMDFjYzc0OThjMDljMDEwZGMzZDUxNzZmYTk3Yzk2MjdlY2IiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI3NTM4OTUxMzcwODYtNWFpbG9iNWQ2N2JrYmNnOTRka2RjMW5ydDFtcW4yOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI3NTM4OTUxMzcwODYtNWFpbG9iNWQ2N2JrYmNnOTRka2RjMW5ydDFtcW4yOTIuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDc3ODExMjA0MDkyODUxNzMwNDAiLCJlbWFpbCI6Im1haWFjYWxlbmRhcjEyM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiYXRfaGFzaCI6Ilh6el9fcVZwMXJNUGxyM0RUckhmS3ciLCJuYW1lIjoiTWFpYSBBSSBDYWxlbmRhciBBc3Npc3RhbnQiLCJwaWN0dXJlIjoiaHR0cHM6Ly9saDMuZ29vZ2xldXNlcmNvbnRlbnQuY29tL2EtL0FPaDE0R2hWcDNQbFNwbG01aWNsTC1EWDlHSzlPZ0RSY3VvZWpOcC1fUHhyPXM5Ni1jIiwiZ2l2ZW5fbmFtZSI6Ik1haWEiLCJmYW1pbHlfbmFtZSI6IkFJIENhbGVuZGFyIEFzc2lzdGFudCIsImxvY2FsZSI6ImVuLUdCIiwiaWF0IjoxNjA4ODM1MDQ4LCJleHAiOjE2MDg4Mzg2NDh9.UrxRRgTSGJgVV_PsSMs0Z7lHEpIVTLocSMS_BHyQudHxW3bP-2ZVeUCyGgPP33Lwrk-VGlCYlA9tkPuyL67tVQ3_8lEQFwbE8ueFbp6oAlLHD29cIJCFFBUVRspSutNRGVqk4B0wM-s5ptuq-saS96Nz6zDWIAKTx0Ol2-aVYhU2p1w4yfHpmV8BIiM4MPtNoNnnGvixfOStcvkFX8wOy8wOenaJK-Iu3VHQp-WmhoVGvPKqspqVJe8RCh6Oh7c3kWiHcSYZPffUzoX2OgBWBmCBAxJBdW4p8AjMIuzSEStnMu1dLTokem3w3uVRmN8XWwR3hLc5LqylkGd0gTHVeA","expiry_date":1608838647546};

// (async () => {
//   try {
//     const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/watch', {
//       method: 'POST',
//       headers: {
//         'Authorization': `Bearer ${token.access_token}`,
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         topicName: 'projects/avid-renderer-293013/topics/Meetings',
//         resourceId: ["INBOX"],
//       }),
//     });
//     console.log(await res.text());
//     process.exit(0);
//   } catch (err) {
//     console.error('ERROR: ', err.stack);
//     process.exit(1);
//   }
// })();


// // const LOG_PATH = path.join(__dirname, 'webhook-log.json');

// // const DATABASE = require('./lib/database.js');

// // // Establish database connection
// // DATABASE.getDatabaseConnection().then(async () => {
// //   const log = fs.existsSync(LOG_PATH) ? require(LOG_PATH) : null;

// //   const allUserData = await DATABASE.getAllUserData();

// //   if (STOP) {
// //     console.log('STOPPING WEBHOOKS');

// //     if (!log) {
// //       console.log('FAILED Log file not found');
// //       process.exit(1);
// //     }

// //     const emails = Object.keys(log);

// //     for (const user of allUserData) {
// //       if (!emails.includes(user.google.email)) continue;

// //       const token = JSON.parse(user.google.token);

// //       try {
// //         const res = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
// //           method: 'POST',
// //           headers: {
// //             'Authorization': `Bearer ${token.access_token}`,
// //             'Content-Type': 'application/json',
// //           },
// //           body: JSON.stringify({
// //             id: log[user.google.email].id,
// //             resourceId: log[user.google.email].resourceId,
// //           }),
// //         });
// //         try {
// //           console.log(`FAILED (${user.google.email})`, await res.json());
// //         } catch (e) {
// //           console.log(`SUCCESS (${user.google.email})`);
// //         }
// //       } catch (e) {
// //         console.log(`FAILED (${user.google.email})`, e);
// //       }
// //     }
// //   } else {
// //     console.log('CREATING WEBHOOKS');

// //     const data = {};
// //     for (const user of allUserData) {
// //       if (log && log[user.google.email]) {
// //         console.log(`FAILED (${user.google.email})`, 'Webhook already exists');
// //         process.exit(1);
// //       }

// //       const token = JSON.parse(user.google.token);

// //       try {
// //         const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${user.google.email}/events/watch`, {
// //           method: 'POST',
// //           headers: {
// //             'Authorization': `Bearer ${token.access_token}`,
// //             'Content-Type': 'application/json',
// //           },
// //           body: JSON.stringify({
// //             id: uuid.v4(),
// //             type: 'web_hook',
// //             address: 'https://09e0034d308f.ngrok.io/auto/webhook',
// //           }),
// //         });
// //         const _json = await res.json();
// //         if (!_json.error) {
// //           data[user.google.email] = _json;
// //           console.log(`SUCCESS (${user.google.email})`, _json);
// //         } else {
// //           console.log(`FAILED (${user.google.email})`, _json.error);
// //         }
// //       } catch (e) {
// //         console.log(`FAILED (${user.google.email})`, e);
// //       }
// //     }

// //     fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 3));
// //   }
// //   console.log('END');
// //   process.exit(0);
// // }).catch((err) => { // mongoose connection error will be handled here
// //   console.error('Database starting error:', err.stack);
// //   process.exit(1);
// // });
