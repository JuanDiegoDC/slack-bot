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
app.use(bodyParser.json());

let credentials = {};
const timezone = "PDT";
const dateTime = "12:00";

fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  credentials = JSON.parse(content);
});

// An access token (from your Slack app or custom integration - usually xoxb)
const token = process.env.SLACK_TOKEN;
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
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
    getMembers()
      .then((res) => {
        res.data.members.forEach((item) => {
          User.findOne({slackId: item.id}, (error, user) => {
            if (error) {
              console.log(error);
            }
            if (!user) {
              let newUser = new User({
                slackId: item.id,
                slackEmail: item.profile.email,
                displayName: item.profile.display_name,
              });
              newUser.save((error) => {
                if (error) {
                  console.log("Error:", error);
                }
              });
            }
          });
        });
      })
      .catch((err) => {
        console.log("Error:", err);
      });
  }
});

function getMembers() {
  return new Promise((resolve, reject) => {
    axios({
      method: "GET",
      url:"https://slack.com/api/users.list",
      headers: {
        Authorization: "Bearer " + process.env.SLACK_TOKEN
      }
    })
    .then((res) => {
      console.log("Response:", res);
      console.log("Members:", res.data.members);
      resolve(res);
    })
    .catch((err) => {
      console.log(err);
      reject(err);
    });
  });
}

app.get("/auth/redirect/:userinfo", (req, res) => {
  const userInfoArr = req.params.userinfo.split("-");
  const user = userInfoArr[0];
  const code = req.query.code;
  const sessionId = userInfoArr[1];
  console.log("User:", user);
  console.log("Code:", code);
  console.log("Session ID:", sessionId);

  if (user && code) {
    setToken(user, sessionId, code, () => {
      rtm.sendMessage("Token set successfully! You can now set events using this bot!", sessionId)
        .then((resp) => {
          // `res` contains information about the posted message
          console.log('Message sent from bot: ', resp);
          res.status(200).send("OK");
        })
        .catch((err) => {
          console.log("Error: ", err);
          res.status(500).send("FAIL");
        });
    });
  }
  else {
    res.status(400).send("FAIL");
  }
});

app.post("/webhook", (req, res) => {
  const botMessage = req.body.result.fulfillment.speech
  const sessionId = req.body.sessionId;
  const intentName = req.body.result.metadata.intentName;
  const slackId = req.body.originalRequest.data.user;
  const parameters = req.body.result.parameters;
  console.log("Parameters:", parameters);
  console.log("Request body", req.body);
  console.log("Robot reply:", botMessage);
  console.log("Session ID:", sessionId);
  console.log("intentName:", intentName);
  console.log("slack ID:", slackId);

  if (intentName === "remind:add") {
    console.log("\nremind:add\n");
    User.findOne({slackId: slackId}, (error, user) => {
      if (error) {
        console.log("FindOne error:", error);
      }
      else if (!user) {
        //User doesn't exist
        //Log error
        rtm.sendMessage("Spooky error occured, are you sure you are a member?", sessionId)
          .then((resp) => {
            // `res` contains information about the posted message
            console.log('Message sent from bot: ', resp);
          })
          .catch((err) => {
            console.log("Error: ", err);
          });
      }
      else {
        //User does exists
        console.log("Found user:", user);
        if (!user.token) {
          getAccessToken(sessionId, slackId);
        }
        else {
          createEvent(parameters.Chore, parameters.date, user.token);
          rtm.sendMessage("Event created!", sessionId)
            .then((resp) => {
              // `res` contains information about the posted message
              console.log('Message sent from bot: ', resp);
            })
            .catch((err) => {
              console.log("Error: ", err);
            });
        }
      }
    })
  }

  else {
    rtm.sendMessage(botMessage, sessionId)
      .then((resp) => {
        // `res` contains information about the posted message
        console.log('Message sent from bot: ', resp);
      })
      .catch((err) => {
        console.log("Error: ", err);
      });
  }

  res.status(200).send("Request received!");
});

function getUserInfo(slackId) {
  return new Promise((resolve, reject) => {
    axios({
      method: "GET",
      url: "https://slack.com/api/users.info?user=" + slackId,
      headers: {
        Authorization: "Bearer " + process.env.SLACK_TOKEN
      }
    })
    .then((res) => {
      resolve(res);
    })
    .catch((err) => {
      reject(err);
    });
  })
}



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
// fs.readFile('credentials.json', (err, content) => {
//   if (err) return console.log('Error loading client secret file:', err);
//   // Authorize a client with credentials, then call the Google Calendar API.
//   authorize(JSON.parse(content), listEvents);
// });

function createEvent(eventName, eventStart, token) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, `http://localhost:1337/auth/redirect/`);

  oAuth2Client.setCredentials(JSON.parse(token));
  const calendar = google.calendar({version: "v3", oAuth2Client});
  console.log("Eventstart:", eventStart);
  const startTime = new Date(eventStart + "T12:00:00");
  console.log("Start time before:", startTime);
  //startTime.setHours(12,0,0);
  console.log("Start time after:", startTime);
  const endTime = new Date(startTime.valueOf() + 1000*1800);
  console.log("End time:", endTime);
  calendar.events.insert({
    auth: oAuth2Client,
    calendarId: "primary",
    resource: {
      summary: eventName,
      start: {
        dateTime: startTime.toISOString(),
        timezone: timezone
      },
      end: {
        dateTime: endTime.toISOString(),
        timezone: timezone
      }
    }
  });
}

function setToken(userId, sessionId, code, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, `http://localhost:1337/auth/redirect/${userId}-${sessionId}`);
  console.log("Code at setToken:", code);
  oAuth2Client.getToken(code, (err, token) => {
    if (err) {
      return console.log("Error retrieving token:", err);
    }
    else {
      User.findOneAndUpdate({slackId: userId}, {token: JSON.stringify(token)}, (error) => {
        if (error) {
          console.log("Update error:", error);
        }
        callback();
      });
    }
  })
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(token, userId, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, `http://localhost:1337/auth/redirect/${userId}`);

  oAuth2Client.setCredentials(JSON.parse(token));
  callback(oAuth2Client);
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(sessionId, userId) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, `http://localhost:1337/auth/redirect/${userId}-${sessionId}`);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);

  rtm.sendMessage('Enable calendar access by visiting this url: ' + String(authUrl), sessionId)
    .then((res) => {
      // `res` contains information about the posted message
      console.log('Message sent: ', res);
    })
    .catch((err) => {
      console.log(err);
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
