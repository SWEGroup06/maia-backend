const NODEMAILER = require('nodemailer');
const URL = require('build-url');
const FS = require('fs');

const TRANSPORTER = NODEMAILER.createTransport({
  service: 'gmail',
  auth: {
    user: '// email',
    pass: '// password'
  }
});

///Users/ihowa/maia-backend/email_templates/reschedule.html
var emailBody = 'ihowa';
async function getHTML() {
 var email = ''
 await FS.readFile('/Users/ihowa/maia-backend/email_templates/reschedule.html', 'utf8', function(err, data) {
   if(err) {
     throw err;
   }
   email = getEmailBody(data);
 });
 console.log('and got here');
 return email;
}
function getEmailBody(data) {
  emailBody = data;
  console.log('got here');
  return emailBody
}

//getHTML().then((data) => {console.log(data);});
(async () => {console.log(await getHTML())})()


/*const mailOptions = {
      from: 'ihowaonaro@gmail.com',
      to: 'ihowaonaro@gmail.com',
      subject: 'Maia\'s weekly rescheduling suggestions.',
      /*text: meetingData.name + '\n' +
            meetingData.from.start + meetingData.from.end + '\n' +
            meetingData.to.start + meetingData.to.end,
      html: emailBody,
    };

    TRANSPORTER.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });*/









module.exports = {
  sendRescheduleEmail: function(email, meetingData) {
    const localHost = 'https://localhost:3000';
    const acceptPath = '/automatic/reschedule/accept';
    const rejectPath = '/automatic/reschedule/reject';

    const acceptURL = URL.buildUrl(localHost, {
      path: acceptPath,
      queryParams: {
        email: email,
        fromStart: meetingData.from.start,
        fromEnd: meetingData.from.end,
        toStart: meetingData.to.start,
        toEnd: meetingData.to.end
      }
    });

    const rejectUrl = URL.buildUrl(localHost, {
      path: rejectPath,
    });

    const mailOptions = {
      from: 'ihowaonaro@gmail.com',
      to: email,
      subject: 'Maia\'s weekly rescheduling suggestions.',
      text: meetingData.name + '\n' +
            meetingData.from.start + meetingData.from.end + '\n' +
            meetingData.to.start + meetingData.to.end,
      //html: emailBody,
    };

    TRANSPORTER.sendMail(mailOptions, function(error, info){
      if (error) {
        console.log(error);
      } else {
        console.log('Email sent: ' + info.response);
      }
    });
  },
};



