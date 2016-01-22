var nconf = require('nconf');

var databaseURI = (process.env.MONGO_HOST || nconf.get('mongo:host') || "localhost") + "/" + (process.env.MONGO_DB_NAME || nconf.get('mongo:database') ||  "colearnr") + "_acl?slaveOk=true";
module.exports = databaseURI;
