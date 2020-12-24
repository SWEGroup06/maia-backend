require('dotenv').config();

const Imap = require('imap')
const inspect = require('util').inspect;

const MAIA_EMAIL = 'maiacalendar123@gmail.com';

const imap = new Imap({
  user: MAIA_EMAIL,
  password: process.env.EMAIL_PASS,
  host: 'imap.gmail.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});

function openInbox(cb) {
  imap.openBox('INBOX', true, cb);
}

imap.once('ready', function() {
  openInbox(function(err, box) {
    if (err) throw err;
    const imapFetch = imap.seq.fetch('1:3', {
      bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
      struct: true
    });
    imapFetch.on('message', function(msg, i) {
      const prefix = `[${i}]`;
    //   console.log(prefix, 'FOUND MESSAGE');
      msg.on('body', function(stream, info) {
        var buffer = '';
        stream.on('data', function(chunk) {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', function() {
          console.log(prefix, 'HEADER', inspect(Imap.parseHeader(buffer)));
        });
      });
    //   msg.once('attributes', function(attrs) {
    //     console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
    //   });
    //   msg.once('end', function() {
    //     console.log(prefix, 'FINISHED');
    //   });
    });
    imapFetch.once('error', function(err) {
      console.log('ERROR:', err);
    });
    imapFetch.once('end', function() {
      console.log('DONE');
      imap.end();
    });
  });
});

imap.once('error', function(err) {
  console.log(err);
});

imap.once('end', function() {
  console.log('Connection ended');
});

imap.connect();