// // Load environment variables
// require("dotenv").config();

// const STOP = process.argv.includes("--stop") || false;

// const fetch = require("node-fetch");
// const uuid = require("uuid");
// const fs = require("fs");
// const path = require("path");

// const LOG_PATH = path.join(__dirname, "webhook-log.json");

// const DATABASE = require("./lib/database.js");

// // Establish database connection
// DATABASE.getDatabaseConnection()
//   .then(async () => {
//     const log = fs.existsSync(LOG_PATH) ? require(LOG_PATH) : null;

//     const allUserData = await DATABASE.getAllUserData();

//     if (STOP) {
//       console.log("STOPPING WEBHOOKS");

//       if (!log) {
//         console.log("FAILED Log file not found");
//         process.exit(1);
//       }

//       const emails = Object.keys(log);

//       for (const user of allUserData) {
//         if (!emails.includes(user.google.email)) continue;

//         const token = JSON.parse(user.google.token);

//         try {
//           const res = await fetch(
//             "https://www.googleapis.com/calendar/v3/channels/stop",
//             {
//               method: "POST",
//               headers: {
//                 Authorization: `Bearer ${token.access_token}`,
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify({
//                 id: log[user.google.email].id,
//                 resourceId: log[user.google.email].resourceId,
//               }),
//             }
//           );
//           try {
//             console.error(`FAILED (${user.google.email})`, await res.json());
//           } catch (e) {
//             console.log(`SUCCESS (${user.google.email})`);
//           }
//         } catch (e) {
//           console.error(`FAILED (${user.google.email})`, e);
//         }
//       }
//     } else {
//       console.log("CREATING WEBHOOKS");

//       const data = {};
//       for (const user of allUserData) {
//         if (log && log[user.google.email]) {
//           console.error(
//             `FAILED (${user.google.email})`,
//             "Webhook already exists"
//           );
//           process.exit(1);
//         }

//         const token = JSON.parse(user.google.token);

//         try {
//           const res = await fetch(
//             `https://www.googleapis.com/calendar/v3/calendars/${user.google.email}/events/watch`,
//             {
//               method: "POST",
//               headers: {
//                 Authorization: `Bearer ${token.access_token}`,
//                 "Content-Type": "application/json",
//               },
//               body: JSON.stringify({
//                 id: uuid.v4(),
//                 type: "web_hook",
//                 address: "https://09e0034d308f.ngrok.io/auto/webhook",
//               }),
//             }
//           );
//           const _json = await res.json();
//           if (!_json.error) {
//             data[user.google.email] = _json;
//             console.log(`SUCCESS (${user.google.email})`, _json);
//           } else {
//             console.error(`FAILED (${user.google.email})`, _json.error);
//           }
//         } catch (e) {
//           console.error(`FAILED (${user.google.email})`, e);
//         }
//       }

//       fs.writeFileSync(LOG_PATH, JSON.stringify(data, null, 3));
//     }
//     console.log("END");
//     process.exit(0);
//   })
//   .catch((err) => {
//     // mongoose connection error will be handled here
//     console.error("Database starting error:", err.stack);
//     process.exit(1);
//   });
