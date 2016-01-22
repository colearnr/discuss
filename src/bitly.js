var bitly_lib = require('bitly')
    , db = require('./db')
    , log = require('./log');

(function(Bitly) {

    var bitly = new bitly_lib('colearnr', 'R_3e9ea6006628f9e21cae01fd671127c7');
    Bitly.convertUrl = function (url, callback) {
        url = decodeURIComponent(url);
        callback(null, url);
        /*
        if (!process.env.ENV_CONFIG || 'dev' == process.env.ENV_CONFIG) {
            callback(null, url);
        } else {
            db.urls.findOne({url: url}, function (err, surl) {
                if (err || !surl || surl.short_url == url) {
                    // Use bitly service
                    bitly.shorten(url, function(err, response) {
                        log.log('debug', 'Trying to shorten', url);
                        if (err) {
                            log.log('error', err);
                            callback(err, url);
                        } else {
                            log.log('debug', 'bitly response', response);
                            var short_url = (response && response.data && response.data.url) ? response.data.url : null;
                            if (short_url) {
                                db.urls.insert({url: url, short_url: short_url, hash: response.data.hash})
                            }
                            callback(err, short_url || url);
                        }
                    });
                } else {
                    callback(err, surl.short_url);
                }
            });
        }
        */
    }

}(exports));
