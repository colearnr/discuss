'use strict'
let nconf = require('nconf')
let numCPUs = require('os').cpus().length
let maxPoolSize = nconf.get('db_pool_size') || 10
let authPrefix = ''
let username = nconf.get('MONGO_USERNAME') || nconf.get('mongo_username')
let password = nconf.get('MONGO_PASSWORD') || nconf.get('mongo_password')
if (nconf.get('use_cluster')) {
  maxPoolSize = Math.round(maxPoolSize / numCPUs)
}
if (username && password) {
  authPrefix = username + ':' + password + '@'
}
let databaseURI = authPrefix + (process.env.MONGO_HOST || nconf.get('mongo:host') || 'localhost') + '/' + (process.env.MONGO_DB_NAME || nconf.get('mongo:database') || 'colearnr') + '?slaveOk=true&maxPoolSize=' + maxPoolSize
let collections = ['users', 'topics', 'learnbits', 'urls']
let db = require('mongojs').connect(databaseURI, collections)

module.exports = db
