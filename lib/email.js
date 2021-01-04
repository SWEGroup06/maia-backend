const Nodemailer = require("nodemailer");
const CONFIG = require("../config.js");

const MAIA_EMAIL = "maiacalendar123@gmail.com";

const transporter = Nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: MAIA_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

module.exports = {
  sendRescheduleEmail: function (email, suggestions) {
    if (!suggestions || !suggestions.length) {
      console.error("No Suggestions");
      return;
    }
    transporter.sendMail(
      {
        from: MAIA_EMAIL,
        to: email,
        subject: "Maia's Weekly Suggestions",
        html: suggestions
          .map(
            (
              meetingData
            ) => `<div style='font-size: 15pt;font-weight: bold;margin-bottom: 5px;margin-top: 20px;'>${
              meetingData.name
            }</div>
      <div style='font-size: 12pt;'><span style='font-weight:bold;margin-right: 10px'>FROM</span> ${new Date(
        meetingData.from.start
      ).toGMTString()} - ${new Date(
              meetingData.from.end
            ).toGMTString()}</h3></div>
      <div style='font-size: 12pt;'><span style='font-weight:bold;margin-right: 10px'>TO</span> ${new Date(
        meetingData.to.start
      ).toGMTString()} - ${new Date(
              meetingData.to.end
            ).toGMTString()}</h3></div>
      <div style='margin-top: 20px'><a href='${
        CONFIG.serverURL
      }/auto/accept?email=${encodeURIComponent(
              JSON.stringify(email)
            )}&meetingData=${encodeURIComponent(
              JSON.stringify(meetingData)
            )}' style='
       background-color: #4caf50;
       color: white;
       border: none;
       padding: 8px 10px;
       display: inline-block;
       vertical-align: middle;
       text-decoration: none;
       text-align: center;
       cursor: pointer;
       font-weight: bold;
       border-radius: 5px;'>
     Accept</a></div>`
          )
          .join("\n"),
      },
      function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("MAIL SUCCESS", info.response);
        }
      }
    );
  },
};
