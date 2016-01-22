// Based on https://github.com/dominicbarnes/node-constants/blob/master/lib/index.js

/**
 * Binds a new "constant" property to an input object
 *
 * @param {object} object
 * @param {string} name
 * @param {mixed}  value
 *
 * @return {object}  The input object
 */
var define = function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

module.exports.define = define;

// ROLES
define('COLEARNR_ROLE', 'colearnr');
define('COLEARNR_USER', 'colearnr');
define('PROLEARNR_ROLE', 'prolearnr');
define('ADMIN_ROLE', 'admin');
define('TOPIC_EXPERT_ROLE', 'expert-');
define('TOPIC_COLLAB_ROLE', 'collab-');
define('TOPIC_ADMIN_ROLE', 'admin-');
define('ALL_TOPIC_ADMIN_ROLE', 'all-topic-admin');

// PERMS
define('VIEW_PERMS', 'view');
define('ADD_PERMS', 'add');
define('EDIT_PERMS', 'edit');
define('DELETE_PERMS', 'delete');

// OTHERS
define('PUBLIC', 'public');
define('PRIVATE', 'private');
define('LEARN_TOPICS_COUNT', 10);