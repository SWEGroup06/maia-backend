const Nodemailer = require("nodemailer");
// const CONFIG = require("../config.js");

const MAIA_EMAIL = "maiacalendar123@gmail.com";

const transporter = Nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: MAIA_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

const endPoint = "https://maia-server.herokuapp.com"; // CONFIG.serverURL;

const generateSuggestionHTML = function (meetingData) {
  const titleHTML = `<div style='color: #000;font-size: 15pt;font-weight: bold;margin-bottom: 5px;margin-top: 20px;'>${meetingData.name}</div>`;

  const generateDateHTML = function (start, end) {
    return `<div style='color: #000;font-size: 12pt;'><span style='font-weight:bold;margin-right: 10px'>FROM</span> ${new Date(
      start
    ).toGMTString()} - ${new Date(end).toGMTString()}</h3></div>`;
  };

  const acceptButtonStyle = `background-color: #4caf50;color: white;border: none;padding: 8px 10px;display: inline-block;vertical-align: middle;
  text-decoration: none;text-align: center;cursor: pointer;font-weight: bold;border-radius: 5px;`;

  const acceptButtonHTML = `<div style='margin-top: 20px'><a href='${endPoint}/auto/accept?email=${encodeURIComponent(
    JSON.stringify(email)
  )}&meetingData=${encodeURIComponent(
    JSON.stringify(meetingData)
  )}' style='${acceptButtonStyle}'>
Accept</a></div>`;

  return (
    titleHTML +
    generateDateHTML(meetingData.from.start, meetingData.from.end) +
    generateDateHTML(meetingData.to.start, meetingData.to.end) +
    acceptButtonHTML
  );
};

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
        html: suggestions.map(generateSuggestionHTML).join("\n"),
      },
      function (error, info) {
        if (error) {
          console.error("sendRescheduleEmail Error: " + error);
        } else {
          console.log("MAIL SUCCESS", info.response);
        }
      }
    );
  },
};
