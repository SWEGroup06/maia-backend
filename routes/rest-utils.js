module.exports = (DATABASE) => {
  const context = {
    async tryFetchGoogleEmail(req, res) {
      // Check if request parameters exist
      if (!req.query.googleEmail && !req.query.slackEmail) {
        res.json({ error: "REQUEST: No Email Provided" });
        return;
      }
      try {
        let googleEmail;
        if (req.query.googleEmail) {
          googleEmail = JSON.parse(decodeURIComponent(req.query.googleEmail));

          // Check if Google email exists
          if (!(await DATABASE.userExists(googleEmail))) {
            res.json({ error: "Not Logged In: Google Email Not Found" });
            return;
          }
        } else {
          const slackEmail = JSON.parse(
            decodeURIComponent(req.query.slackEmail)
          );

          // Check if Slack email exists
          if (!(await DATABASE.userExists(slackEmail))) {
            res.json({ error: "Not Logged In: Slack Email Not Found" });
            return;
          }

          // Get Google email from Slack email
          googleEmail = await DATABASE.getGoogleEmailFromSlackEmail(slackEmail);
          if (!googleEmail) {
            // Should never reach this point
            res.json({ error: "Not Logged In: Internal Error" });
            return;
          }
        }
        return googleEmail;
      } catch (err) {
        // Any other type of error
        const msg = "tryFetchGoogleEmail Error: " + err.message;
        console.error(msg);
        res.json({ error: msg });
        return;
      }
    },
    async tryFetchGoogleEmails(req, res) {
      // Check if request parameters exist
      if (!req.query.googleEmails && !req.query.slackEmails) {
        res.json({ error: "REQUEST: No Emails Provided" });
        return;
      }
      try {
        let googleEmails;
        if (req.query.googleEmails) {
          googleEmails = JSON.parse(decodeURIComponent(req.query.googleEmails));

          // Check if Google email exists
          const notLoggedIn = await DATABASE.allUsersExists(googleEmails);
          if (notLoggedIn) {
            res.json({
              error: `Not Logged In: ${notLoggedIn.join(
                " "
              )} Google Emails Not Found`,
            });
            return;
          }
        } else {
          const slackEmails = JSON.parse(
            decodeURIComponent(req.query.slackEmails)
          );

          // Check if Slack email exists
          const notLoggedIn = await DATABASE.allUsersExists(slackEmails);
          if (notLoggedIn) {
            res.json({
              error: `Not Logged In: ${notLoggedIn.join(
                " "
              )} Slack Emails Not Found`,
            });
            return;
          }

          // Get Google email from Slack email
          googleEmails = await DATABASE.getGoogleEmailsFromSlackEmails(
            slackEmails
          );
          if (!googleEmails) {
            // Should never reach this point
            res.json({ error: "Not Logged In: Internal Error" });
            return;
          }
        }

        return googleEmails;
      } catch (err) {
        // Any other type of error
        const msg = "tryFetchGoogleEmails Error: " + err.message;
        console.error(msg);
        res.json({ error: msg });
        return;
      }
    },
  };

  return context;
};
