var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var userSchema = new Schema({
  token: {
    type: String,
    required: false
  },
  slackId: String,
  slackUsername: String,
  slackEmail: String,
  slackDmId: String,
  displayName: String,
  meetingLength: {
    type: Number,
    default: 30
  }
});

var taskSchema = new Schema({
  subject: {
    type: String,
    required: true
  },
  day: {
    type: String,
    required: true
  },
  googleCalendarEventId: String,
  requesterid: String
});

const meetingSchema = new Schema({
  topic: {
    type: String,
    required: true
  },
  attendees: {
    type: Array,
    required: true
  },
  date: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  owner: {
    type: Object,
    required: true
  }
});

var User = mongoose.model('User', userSchema);
var Task = mongoose.model('Task', taskSchema);
var Meeting = mongoose.model("Meeting", meetingSchema);

module.exports = {
  User: User,
  Task: Task,
  Meeting: Meeting
}
