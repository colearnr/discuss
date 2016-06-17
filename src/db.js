'use strict'
const nconf = require('nconf')
const numCPUs = require('os').cpus().length
let maxPoolSize = nconf.get('db_pool_size') || 10
let authPrefix = ''
const username = nconf.get('MONGO_USERNAME') || nconf.get('mongo_username')
const password = nconf.get('MONGO_PASSWORD') || nconf.get('mongo_password')
if (nconf.get('use_cluster')) {
  maxPoolSize = Math.round(maxPoolSize / numCPUs)
}
if (username && password) {
  authPrefix = username + ':' + password + '@'
}
const mongojs = require('mongojs')
const databaseURI = authPrefix + (process.env.MONGO_HOST || nconf.get('mongo:host') || 'localhost') + '/' + (process.env.MONGO_DB_NAME || nconf.get('mongo:database') || 'colearnr') + '?slaveOk=true&maxPoolSize=' + maxPoolSize
const collections = ['users', 'topics', 'learnbits', 'urls']
const db = mongojs(databaseURI, collections)

module.exports = db
