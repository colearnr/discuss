var RDB = require('./redis');
var reds = require('reds');
reds.createClient = function () {
  return reds.client = RDB;
};

module.exports = reds;
