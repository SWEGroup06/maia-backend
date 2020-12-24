require('dotenv').config();

const Imap = require('imap');
const {htmlToText} = require('html-to-text');

const MAIA_EMAIL = 'maiacalendar123@gmail.com';

const imap = new Imap({
  user: MAIA_EMAIL,
  password: process.env.EMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: {rejectUnauthorized: false},
});

const context = {
  init: () => new Promise((resolve, reject) => {
    imap.connect();
    imap.once('ready', resolve);
    imap.once('error', (err) => reject(err));
  }),
  getLatestEmail: () => new Promise((resolve, reject) => {
    imap.openBox('INBOX', true, function(err, box) {
      if (err) {
        reject(err);
        return;
      }
      const fetchRes = imap.seq.fetch(box.messages.total + ':*', {bodies: ['HEADER.FIELDS (SUBJECT)', 'TEXT']});

      fetchRes.on('message', function(msg, seqno) {
        let count = 0;
        const res = {};
        msg.on('body', function(stream, info) {
          let buffer = '';
          stream.on('data', function(chunk) {
            buffer += chunk.toString();
          });
          stream.once('end', function() {
            const content = htmlToText(JSON.parse(JSON.stringify(buffer).replace(/=\\r\\n/g, ''))).trim();
            if (info.which == 'TEXT') {
              res.body = content.replace(/\\n/g, '');
            } else {
              res.subject = content.split('Subject: ')[1];
            }
            count++;
            if (count == 2) resolve(res);
          });
        });
      });

      fetchRes.once('error', (err) => reject(err));
      fetchRes.once('end', () => imap.end());
    });

    imap.once('error', (err) => reject(err));
  }),
};

module.exports = context;
