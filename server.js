const { WebClient } = require('@slack/client');
const { RTMClient } = require('@slack/client');
const fs = require('fs');
const readline = require('readline');
import axios from "axios";
import express from "express";
const {google} = require('googleapis');
import bodyParser from "body-parser";
import models from "./models.js";
import mongoose from "mongoose";
const User = models.User;

const app = express();
app.use(bodyParser.json())

// An access token (from your Slack app or custom integration - usually xoxb)
const token = process.env.SLACK_TOKEN;
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';

// The client is initialized and then started to get an active connection to the platform
const rtm = new RTMClient(token);
rtm.start();

mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true}, (error) => {
  if (error) {
    console.log(error);
  }
  else {
    console.log("Success, connected to MongoDB!");
  }
})

app.get("/test", (req, res) => {
  console.log("TESTED!");
  const code = req.query.code;
  console.log("Code:", code);

  res.status(200).send("OK");
});

app.post("/webhook", (req, res) => {
  const botMessage = req.body.result.fulfillment.speech
  const sessionId = req.body.sessionId;
  const intentName = req.body.result.metadata.intentName;
  const slackId = req.body.originalRequest.data.user;
  console.log("Request body", req.body);
  console.log("Robot reply:", botMessage);
  console.log("Session ID:", sessionId);
  console.log("intentName:", intentName);
  console.log("slack ID:", slackId);

  if (intentName === "remind:add") {
    User.findOne({slackId: slackId}, (error, user) => {
      if (error) {
        console.log("FindOne error:", error);
      }
      else if (!user) {
        let newUser = new User({
          slackId: slackId,
          slackDmId: sessionId,
        });
        newUser.save()
          .then((err) => {
            if(err) {
              console.log("Save error:", err);
            }
        })
      }
    })
  }

  rtm.sendMessage(botMessage, sessionId)
    .then((resp) => {
      // `res` contains information about the posted message
      console.log('Message sent from bot: ', resp);
    })
    .catch((err) => {
      console.log("Error: ", err);
    });

  res.status(200).send("Request received!");
});



// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
const defaultChannel = 'DC7077XLY';

// The RTM client can send simple string messages
rtm.sendMessage('Bot waking up', defaultChannel)
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res);
  })
  .catch((err) => {
    console.log(err);
  });

function forwardInput(event) {
  axios({
    method: "POST",
    url: "https://api.dialogflow.com/v1/query?v=20150910",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + process.env.CLIENT_ACCESS_TOKEN
    },
    data: {
      "sessionId": event.channel,
      "lang": "en",
      "query": event.text,
      originalRequest: {
        source: "slack",
        data: {
          user: event.user,
          text: event.text,
          channel: event.channel
        }
      }
    }
  })
  .then((response) => {
    //console.log("Response:", response)
  })
  .catch((error) => {
    console.log("Error:", error);
  });
}

rtm.on('message', (event) => {
  // For structure of `event`, see https://api.slack.com/events/message

  console.log("Event:", event);

  forwardInput(event);

  // Log the message
  //console.log(`(channel:${message.channel}) ${message.user} says: ${message.text}`)
});

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[1]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map((event, i) => {
        const start = event.start.dateTime || event.start.date;
        console.log(`${start} - ${event.summary}`);
      });
    } else {
      console.log('No upcoming events found.');
    }
  });
}

app.listen(1337, () => {
  console.log("Connected!");
});
