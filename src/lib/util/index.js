var _ = require('lodash')
    , constants = require("../perms/constants");

var util = {

    // Regular expression that checks for hex value
    checkForHexRegExp: new RegExp("^[0-9a-fA-F]{24}$"),

    validOid: function(id) {
        var self = this;
        if (id != null && 'number' != typeof id && (id.length != 12 && id.length != 24)) {
            return false;
        } else {
            // Check specifically for hex correctness
            if(typeof id == 'string' && id.length == 24) return self.checkForHexRegExp.test(id);
            return true;
        }
    }
};

module.exports = util;
