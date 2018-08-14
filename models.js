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

var User = mongoose.model('User', userSchema);
var Task = mongoose.model('Task', taskSchema);

module.exports = {
  User: User,
  Task: Task
}
