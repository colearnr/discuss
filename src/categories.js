var RDB = require('./redis.js'),
  posts = require('./posts.js'),
  utils = require('./../public/src/utils.js'),
  user = require('./user.js'),
  async = require('async'),
  db = require('./db'),
  topics = require('./topics.js'),
  plugins = require('./plugins'),
  perms_lib = require('./lib/perms'),
  util = require('./lib/util'),
  log = require('./log'),
  nconf = require('nconf'),
  _ = require('lodash'),
  winston = require('winston'),
  shorten_lib = require('./bitly'),
  nconf = require('nconf')

;(function (Categories) {
  'use strict'

  Categories.create = function (data, callback) {
    RDB.incr('global:next_category_id', function (err, cid) {
      if (err) {
        return callback(err, null)
      }
      var cidToUse = data.cid || cid
      var slug = cidToUse + '/' + utils.slugify(data.name)
      RDB.rpush('categories:cid', cidToUse)

      var category = {
        cid: cidToUse,
        name: data.name,
        description: data.description,
        icon: data.icon,
        blockclass: data.blockclass,
        privacy_mode: data.privacy_mode,
        added_by: data.added_by,
        slug: slug,
        topic_count: 0,
        disabled: 0,
        order: data.order
      }

      RDB.hmset('category:' + cidToUse, category, function (err, data) {
        callback(err, category)
      })
    })
  }

  Categories.getOrCreateCategory = function (user_oid, topic_oid, callback) {
    log.info('getOrCreateCategory', user_oid, topic_oid)
    if (!util.validOid(topic_oid)) {
      callback('Invalid topic_oid', null)
      return
    }
    db.topics.findOne({_id: db.ObjectId(topic_oid)}, function (err, topic) {
      Categories.getCategoryById(topic_oid, user_oid, function (err, category) {
        if (!category) {
          var slug = topic_oid + '/' + ((topic && topic.name) ? utils.slugify(topic.name) : 'topic')
          var data = {
            'cid': '' + topic_oid,
            'name': (topic && topic.name) ? topic.name : '',
            'slug': slug,
            'description': (topic && topic.description) ? topic.description : '',
            'blockclass': 'category-blue',
            'icon': 'icon-comment',
            'disabled': (topic && topic.hidden) ? 1 : 0,
            'privacy_mode': (topic && topic.privacy_mode) ? topic.privacy_mode : 'public',
            'added_by': user_oid
          }
          log.info('getOrCreateCategory', 'Attempting to create a new category', data)
          Categories.create(data, function (err, categoryData) {
            log.log('debug', 'Cid of the new topic is', categoryData.cid)
            Categories.getFullData(categoryData, user_oid, callback)
          })
        } else {
          callback(err, category)
        }
      })

    })

  }

  Categories.getFullData = function (categoryData, current_user, callback) {
    log.log('debug', 'getFullData', categoryData.cid, current_user)
    if (!categoryData) {
      log.warn('getFullData', 'Category data is null!')
      callback(null, null)
      return
    }
    var category_id = categoryData.cid || categoryData.category_id
    function getTopicIds (next) {
      Categories.getTopicIds(category_id, 0, 19, next)
    }

    function getActiveUsers (next) {
      Categories.getActiveUsers(category_id, next)
    }

    function getSidebars (next) {
      plugins.fireHook('filter:category.build_sidebars', [], function (err, sidebars) {
        next(err, sidebars)
      })
    }

    function _sendData () {
      var category_name = categoryData.name,
        category_slug = categoryData.slug,
        disabled = categoryData.disabled || '0',
        privacy_mode = categoryData.privacy_mode || 'public',
        added_by = categoryData.added_by,
        hidden = categoryData.hidden,
        topic_oid = (categoryData && categoryData.raw_topic) ? categoryData.raw_topic._id : null,
        topic_id = (categoryData && categoryData.raw_topic) ? categoryData.raw_topic.id : 'topic',
        category_description = categoryData.description

      async.parallel([getTopicIds, getActiveUsers, getSidebars], function (err, results) {
        var tids = results[0],
          active_users = results[1],
          sidebars = results[2]

        function getTopics (next) {
          topics.getTopicsByTids(tids, current_user, function (topicsData) {
            next(null, topicsData)
          }, category_id)
        }

        function getModerators (next) {
          Categories.getModerators(category_id, next)
        }

        function getActiveUsers (next) {
          user.getMultipleUserFields(active_users, ['uid', 'username', 'userslug', 'picture'], function (err, users) {
            next(err, users)
          })
        }
        var curl = encodeURIComponent(nconf.get('url') + 'category/' + category_slug)
        shorten_lib.convertUrl(curl, function (err, scurl) {
          log.log('debug', 'category_url', curl, scurl)
          // FIXME: topic_url is not using dynamic host
          var categoryData = {
            'cid': category_id,
            'category_name': category_name,
            'category_description': category_description,
            'privacy_mode': privacy_mode,
            'hidden': hidden,
            'added_by': added_by,
            'disabled': disabled,
            'slug': category_slug,
            'show_sidebar': 'show',
            'show_topic_button': 'inline-block',
            'no_topics_message': 'hidden',
            'topic_row_size': 'col-md-9',
            'category_id': category_id,
            'active_users': [],
            'topics': [],
            'short_url': scurl,
            'sidebars': sidebars,
            'topic_url': (topic_oid) ? (nconf.get('app_home') + '/topic/' + topic_oid + '/' + topic_id) : '#'
          }

          if (!tids || tids.length === 0) {
            getModerators(function (err, moderators) {
              categoryData.moderator_block_class = moderators.length > 0 ? '' : 'none'
              categoryData.moderators = moderators
              categoryData.show_sidebar = 'hidden'
              categoryData.no_topics_message = 'show'
              callback(null, categoryData)
            })
          } else {
            async.parallel([getTopics, getModerators, getActiveUsers], function (err, results) {
              categoryData.topics = results[0] || {}
              categoryData.moderator_block_class = results[1].length > 0 ? '' : 'none'
              categoryData.moderators = results[1]
              categoryData.active_users = results[2]
              categoryData.show_sidebar = categoryData.topics.length > 0 ? 'show' : 'hidden'
              callback(null, categoryData)
            })
          }
        })

      })
    }

    if (current_user && categoryData && categoryData.raw_topic) {
      db.users.findOne({_id: current_user}, function (err, user) {
        perms_lib.checkTopicViewAccess(user, categoryData.raw_topic, function (err, hasViewAccess) {
          if (err || !hasViewAccess) {
            callback(err, {error: 'Looks like you don\`t have permission to view this discussion! Please contact support.'})
          } else {
            _sendData()
          }
        })
      })
    } else {
      _sendData()
    }
  }

  Categories.getCategoryById = function (category_id, current_user, callback) {
    log.log('debug', 'getCategoryById', category_id, current_user)
    Categories.getCategoryData(category_id, current_user, function (err, categoryData) {
      if (err) {
        return callback(err, null)
      }
      categoryData.cid = category_id
      categoryData.category_id = category_id
      Categories.getFullData(categoryData, current_user, callback)
    })
  }

  Categories.getCategoryTopics = function (cid, start, stop, uid, callback) {
    Categories.getTopicIds(cid, start, stop, function (err, tids) {
      topics.getTopicsByTids(tids, uid, function (topicsData) {
        callback(topicsData)
      }, cid)
    })
  }

  Categories.getTopicIds = function (cid, start, stop, callback) {
    // log.log('debug', 'getTopicIds', cid)
    RDB.zrevrange('categories:' + cid + ':tid', start, stop, function (err, ftids) {
      var tids = ftids
      try {
        db.topics.findOne({_id: db.ObjectId(cid)}, function (err, ptopic) {
          if (err || !ptopic) {
            callback(err, tids)
          } else {
            var parent_path = ptopic.path ? ptopic.path : ','
            db.topics.find({path: new RegExp(utils.quote_regex(parent_path + ptopic.id) + ',')}, function (err, stopics) {
              if (err || !stopics.length) {
                callback(err, tids)
              } else {
                var done = 0
                stopics.forEach(function (st) {
                  RDB.zrevrange('categories:' + st._id + ':tid', start, stop, function (err, mtids) {
                    if (mtids) {
                      if (!tids) {
                        tids = []
                      }
                      tids = tids.concat(mtids)
                    }
                    done++
                    if (done == stopics.length) {
                      callback(err, tids)
                    }
                  })
                })
              }
            })
          }
        })
      } catch (e) {
        callback(err, tids)
      }
    })
  }

  Categories.getActiveUsers = function (cid, callback) {
    RDB.smembers('cid:' + cid + ':active_users', callback)
  }

  Categories.getAllCategories = function (callback, current_user) {
    // log.log('debug', 'getAllCategories', current_user)
    RDB.lrange('categories:cid', 0, -1, function (err, cids) {
      RDB.handle(err)
      Categories.getCategories(cids, callback, current_user)
    })
  }

  Categories.getModerators = function (cid, callback) {
    // log.log('debug', 'getModerators', cid)
    RDB.smembers('cid:' + cid + ':moderators', function (err, mods) {
      if (!err) {
        if (mods && mods.length) {
          user.getMultipleUserFields(mods, ['username'], function (err, moderators) {
            callback(err, moderators)
          })
        } else {
          callback(null, [])
        }
      } else {
        callback(err, null)
      }

    })
  }

  Categories.privileges = function (cid, uid, callback) {
    function isModerator (next) {
      user.isModerator(uid, cid, function (isMod) {
        // log.log('info', 'isModerator', uid, cid, isMod)
        next(null, isMod)
      })
    }

    // CoLearnr - support for collaborators
    function isCollaborator (next) {
      if (cid) {
        try {
          var oid = db.ObjectId('' + cid)
          db.topics.findOne({_id: oid}, function (err, topic) {
            if (err || !topic) {
              next(null, false)
            } else {
              perms_lib.isTopicCollab({_id: uid}, topic, function (err, isCollab) {
                next(err, isCollab)
              })
            }
          })
        } catch (e) {
          next(null, false)
        }
      } else {
        next(null, false)
      }
    }

    function isAdministrator (next) {
      user.isAdministrator(uid, function (isAdmin) {
        // log.log('info', 'isAdmin', uid, cid, isAdmin)
        next(null, isAdmin)
      })
    }

    async.parallel([isModerator, isCollaborator, isAdministrator], function (err, results) {
      callback({
        editable: results[0] || results[2],
        collaborate: results[1] || results[2],
        view_deleted: results[0] || results[2]
      })
    })
  }

  Categories.isTopicsRead = function (cid, uid, callback) {
    RDB.zrange('categories:' + cid + ':tid', 0, -1, function (err, tids) {
      topics.hasReadTopics(tids, uid, function (hasRead) {
        var allread = true
        for (var i = 0, ii = tids.length; i < ii; i++) {
          if (hasRead[i] === 0) {
            allread = false
            break
          }
        }
        callback(allread)
      })
    })
  }

  Categories.markAsRead = function (cid, uid) {
    RDB.sadd('cid:' + cid + ':read_by_uid', uid)
  }

  Categories.hasReadCategories = function (cids, uid, callback) {
    var batch = RDB.multi()

    for (var i = 0, ii = cids.length; i < ii; i++) {
      batch.sismember('cid:' + cids[i] + ':read_by_uid', uid)
    }

    batch.exec(function (err, hasRead) {
      callback(hasRead)
    })
  }

  Categories.hasReadCategory = function (cid, uid, callback) {
    RDB.sismember('cid:' + cid + ':read_by_uid', uid, function (err, hasRead) {
      RDB.handle(err)

      callback(hasRead)
    })
  }

  Categories.getRecentReplies = function (cid, count, callback) {
    RDB.zrevrange('categories:recent_posts:cid:' + cid, 0, (count < 10) ? 10 : count, function (err, pids) {
      if (err) {
        winston.err(err)
        callback([])
        return
      }

      if (pids.length === 0) {
        callback([])
        return
      }

      posts.getPostSummaryByPids(pids, function (err, postData) {
        if (postData.length > count) {
          postData = postData.slice(0, count)
        }
        callback(postData)
      })
    })
  }

  Categories.moveRecentReplies = function (tid, oldCid, cid, callback) {
    function movePost (pid, callback) {
      posts.getPostField(pid, 'timestamp', function (timestamp) {
        RDB.zrem('categories:recent_posts:cid:' + oldCid, pid)
        RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid)
      })
    }

    topics.getPids(tid, function (err, pids) {
      if (!err) {
        async.each(pids, movePost, function (err) {
          if (!err) {
            callback(null, 1)
          } else {
            winston.err(err)
            callback(err, null)
          }
        })
      } else {
        winston.err(err)
        callback(err, null)
      }
    })
  }

  Categories.moveActiveUsers = function (tid, oldCid, cid, callback) {
    function updateUser (uid) {
      Categories.addActiveUser(cid, uid)
      Categories.isUserActiveIn(oldCid, uid, function (err, active) {
        if (!err && !active) {
          Categories.removeActiveUser(oldCid, uid)
        }
      })
    }

    topics.getUids(tid, function (err, uids) {
      if (!err && uids) {
        for (var i = 0; i < uids.length; ++i) {
          updateUser(uids[i])
        }
      }
    })
  }

  Categories.getCategoryData = function (cid, user_oid, callback) {
    // log.log('debug', 'getCategoryData', cid, user_oid)
    if (!cid) {
      log.warn('Category id is null')
      callback(new Error('invalid-category-id'), null)
      return
    } else {
      var cidInt = cid
      try {
        cidInt = parseInt(cid, 10)
      } catch (e) {}
      var args = [{discuss_id: cidInt, path: null}]
      try {
        var oid = db.ObjectId('' + cid)
        args = [{_id: oid}]
      } catch (e) {}
      RDB.exists('category:' + cid, function (err, exists) {
        if (exists) {
          RDB.hgetall('category:' + cid, function (err, categoryData) {
            db.topics.findOne({$or: args}, function (err, topic) {
              if (topic) {
                categoryData.raw_topic = topic
                categoryData.name = topic.name
                categoryData.description = topic.description
                categoryData.added_by = topic.added_by
                categoryData.hidden = topic.hidden
                categoryData.collaborators = topic.collaborators
                categoryData.privacy_mode = topic.privacy_mode
              }
              callback(err, categoryData)
            })
          })
        } else {
          log.warn('No category found in redis for ', cid)
          var categoryData = {}
          db.topics.findOne({$or: args}, function (err, topic) {
            if (topic) {
              categoryData.cid = '' + topic._id
              categoryData.raw_topic = topic
              categoryData.name = topic.name
              categoryData.description = topic.description
              categoryData.added_by = topic.added_by
              categoryData.hidden = topic.hidden
              categoryData.slug = topic.id
              categoryData.disabled = topic.hidden ? 1 : 0
              categoryData.topic_count = 0
              categoryData.blockclass = 'category-blue'
              categoryData.icon = 'icon-comment'
              categoryData.collaborators = topic.collaborators
              categoryData.privacy_mode = topic.privacy_mode
              log.info('getCategoryData', 'Attempting to create a new category', categoryData)
              Categories.create(categoryData, function (err, categoryData) {
                log.log('debug', 'Cid of the new topic is', categoryData.cid)
                Categories.getFullData(categoryData, user_oid, callback)
              })
            } else {
              log.warn('No such topic exists', cid)
              callback(err, categoryData)
            }
          })
        }
      })
    }
  }

  Categories.getCategoryField = function (cid, field, callback) {
    RDB.hget('category:' + cid, field, callback)
  }

  Categories.getCategoryFields = function (cid, fields, callback) {
    RDB.hmgetObject('category:' + cid, fields, callback)
  }

  Categories.setCategoryField = function (cid, field, value) {
    RDB.hset('category:' + cid, field, value)
  }

  Categories.incrementCategoryFieldBy = function (cid, field, value) {
    RDB.hincrby('category:' + cid, field, value)
  }

  Categories.getCategories = function (cids, callback, current_user) {
    // log.log('debug', 'getCategories', cids, current_user)
    if (!cids || !Array.isArray(cids) || cids.length === 0) {
      callback({
        'categories': []
      })
      return
    } else {
      cids = _.uniq(cids)
    }

    function getCategory (cid, callback) {
      Categories.getCategoryData(cid, current_user, function (err, categoryData) {
        if (err || !categoryData) {
          winston.warn('Attempted to retrieve cid ' + cid + ', but nothing was returned!')
          callback(null, null)
          return
        }

        Categories.hasReadCategory(cid, current_user, function (hasRead) {
          categoryData.badgeclass = (categoryData.privacy_mode == 'public' && (parseInt(categoryData.topic_count, 10) === 0 || (hasRead && current_user !== 0))) ? '' : 'badge-important'
          categoryData.badgeclass += ' ' + (categoryData.privacy_mode == 'private' ? 'badge-private' : '')
          callback(null, categoryData)
        })

      })
    }

    async.map(cids, getCategory, function (err, categories) {
      if (err) {
        winston.err(err)
        callback(null)
        return
      }
      // CoLearnr: Filter out private categories
      /*
      categories = categories.filter(function(category) {
      	return !!category && (category.privacy_mode == 'public' || category.added_by == current_user)
      }).sort(function(a, b) {
      	return parseInt(a.order, 10) - parseInt(b.order, 10)
      })
      */
      var filteredCategories = []
      var done = 0
      categories.forEach(function (acategory) {
        if (!acategory || !util.validOid(acategory.cid)) {
          done++
          if (done == categories.length) {
            callback({
              'categories': filteredCategories
            })
          }
        } else if (acategory.raw_topic) {
          db.users.findOne({_id: current_user}, function (err, user) {
            perms_lib.checkTopicViewAccess(user, acategory.raw_topic, function (err, hasViewAccess) {
              if (!err && hasViewAccess) {
                filteredCategories.push(acategory)
              }
              done++
              if (done == categories.length) {
                callback({
                  'categories': filteredCategories
                })
              }
            })
          })
        } else {
          done++
          if (done == categories.length) {
            callback({
              'categories': filteredCategories
            })
          }
        }
      })
    })

  }

  Categories.isUserActiveIn = function (cid, uid, callback) {
    RDB.lrange('uid:' + uid + ':posts', 0, -1, function (err, pids) {
      if (err) {
        return callback(err, null)
      }

      function getPostCategory (pid, callback) {
        posts.getPostField(pid, 'tid', function (tid) {
          topics.getTopicField(tid, 'cid', function (err, postCid) {
            if (err) {
              return callback(err, null)
            }

            return callback(null, postCid)
          })
        })
      }

      var index = 0,
        active = false

      async.whilst(
        function () {
          return active === false && index < pids.length
        },
        function (callback) {
          getPostCategory(pids[index], function (err, postCid) {
            if (err) {
              return callback(err)
            }

            if (postCid === cid) {
              active = true
            }

            ++index
            callback(null)
          })
        },
        function (err) {
          if (err) {
            return callback(err, null)
          }

          callback(null, active)
        }
      )
    })
  }

  Categories.addActiveUser = function (cid, uid) {
    if (parseInt(uid, 10))
      RDB.sadd('cid:' + cid + ':active_users', uid)
  }

  Categories.removeActiveUser = function (cid, uid) {
    RDB.srem('cid:' + cid + ':active_users', uid)
  }

}(exports))
