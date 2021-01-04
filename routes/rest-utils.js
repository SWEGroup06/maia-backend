module.exports = (DATABASE) => {
  const context = {
    async tryFetchGoogleEmail(req, res) {
      // Check if request parameters exist
      if (!req.query.googleEmail && !req.query.slackEmail) {
        res.json({ error: "No email provided" });
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
      } catch (err) {
        // Any other type of error
        const msg = "getGoogleEmail Error: " + err.message;
        console.error(msg);
        res.json({ error: msg });
        return;
      }
    },
  };

  return context;
};
