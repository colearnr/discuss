var nconf = require('nconf'),
	cluster = require('cluster'),
 	numCPUs = require('os').cpus().length,
	maxPoolSize = nconf.get('db_pool_size') || 10,
	authPrefix = '';
if (nconf.get('use_cluster')) {
	maxPoolSize = Math.round(maxPoolSize / numCPUs);
}
if (nconf.get('mongo_username') && nconf.get('mongo_password')) {
	authPrefix = nconf.get('mongo_username') + ':' + nconf.get('mongo_password')  + '@';
}
var databaseURI = authPrefix + (process.env.MONGO_HOST || nconf.get('mongo:host') || 'localhost') + '/' + (process.env.MONGO_DB_NAME || nconf.get('mongo:database') ||  'colearnr') + '?slaveOk=true&maxPoolSize=' + maxPoolSize;
var collections = ['users', 'topics', 'learnbits', 'urls']
    , db = require('mongojs').connect(databaseURI, collections);

module.exports = db;
