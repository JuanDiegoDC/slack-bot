import { RTMClient, WebClient } from '@slack/client';
import express from 'express'
import bodyParser from 'body-parser'
import {google} from 'googleapis'
const fs = require('fs');
const readline = require('readline');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';

// An access token (from your Slack app or custom integration - xoxp, xoxb, or xoxa)
const token = process.env.SLACK_TOKEN;

const web = new WebClient(token);

const rtm = new RTMClient(token);

rtm.start();

rtm.on('message', function(event) {
  console.log(event);
  if (event.type !== 'message') {
    return
  }
  handleMessage(event);
})

handleMessage = (event) => {
  axios.get(`url goes here`, )
  .then(res => {

  })
}

// This argument can be a channel ID, a DM ID, a MPDM ID, or a group ID
const conversationId = 'DC7RFR5B7';

// See: https://api.slack.com/methods/chat.postMessage
web.chat.postMessage({ channel: conversationId, text: 'Hello there' })
  .then((res) => {
    // `res` contains information about the posted message
    console.log('Message sent: ', res.ts);
  })
  .catch(console.error);
