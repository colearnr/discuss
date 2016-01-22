var winston = require('winston');

var log = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
                handleExceptions: false,
                json: false,
                timestamp: true,
                level: (!process.env.ENV_CONFIG || 'dev' == process.env.ENV_CONFIG || 'dev-test' == process.env.ENV_CONFIG) ? 'debug' : 'info'
            })
    ]
});

module.exports = log;
