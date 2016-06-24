var RDB = require('./redis.js'),
  schema = require('./schema.js'),
  posts = require('./posts.js'),
  utils = require('./../public/src/utils.js'),
  user = require('./user.js'),
  categories = require('./categories.js'),
  posts = require('./posts.js'),
  threadTools = require('./threadTools.js'),
  postTools = require('./postTools'),
  Notifications = require('./notifications'),
  async = require('async'),
  db = require('./db'),
  perms_lib = require('./lib/perms'),
  feed = require('./feed.js'),
  favourites = require('./favourites.js'),
  meta = require('./meta.js'),
  reds = require('reds'),
  topicSearch = reds.createSearch('nodebbtopicsearch'),
  nconf = require('nconf'),
  winston = require('winston'),
  log = require('./log'),
  shorten_lib = require('./bitly'),
  util = require('./lib/util'),
  validator = require('validator')

;(function (Topics) {
  Topics.getTopicData = function (tid, callback) {
    // log.log('debug', 'tid', tid)
    RDB.hgetall('topic:' + tid, function (err, data) {
      if (err === null) {
        if (data) {
          data.title = validator.escape(data.title)
          if (data.timestamp) {
            data.relativeTime = new Date(parseInt(data.timestamp, 10)).toISOString()
          }
        }

        callback(data)
      } else {
        log.log('error', err)
      }
    })
  }

  Topics.getTopicDataWithUser = function (tid, callback) {
    Topics.getTopicData(tid, function (topic) {
      user.getUserFields(topic.uid, ['username', 'userslug', 'picture'] , function (err, userData) {
        topic.username = userData.username || 'Guest'
        topic.userslug = userData.userslug || 'guest'
        topic.picture = userData.picture || '/images/profile/profile_1.jpg'
        callback(topic)
      })
    })
  }

  Topics.getTopicPosts = function (tid, start, end, current_user, callback) {
    // log.log('debug', 'getTopicPosts', tid, start, end, current_user)
    posts.getPostsByTid(tid, start, end, function (postData) {
      if (Array.isArray(postData) && !postData.length)
        return callback([])

      function getFavouritesData (next) {
        var pids = []
        for (var i = 0; i < postData.length; ++i) {
          if (postData[i]) {
            pids.push(postData[i].pid)
          }
        }

        favourites.getFavouritesByPostIDs(pids, current_user, function (fav_data) {
          next(null, fav_data)
        })
      }

      function addUserInfoToPosts (next) {
        function iterator (post, callback) {
          posts.addUserInfoToPost(post, function () {
            callback(null)
          })
        }

        async.each(postData, iterator, function (err) {
          next(err, null)
        })
      }

      function getPrivileges (next) {
        var privList = []
        for (var i = 0; i < postData.length; i++) {
          postTools.privileges(postData[i].pid, current_user, function (privData) {
            privList.push(privData)
            if (privList.length == postData.length) {
              next(null, privList)
            }
          })
        }
      }

      async.parallel([getFavouritesData, addUserInfoToPosts, getPrivileges], function (err, results) {
        var fav_data = results[0],
          privileges = results[2]

        for (var i = 0; i < postData.length; ++i) {
          postData[i].fav_button_class = fav_data[postData[i].pid] ? 'btn-warning' : ''
          postData[i].fav_star_class = fav_data[postData[i].pid] ? 'fa fa-star' : 'fa fa-star-o'
          // log.log('info', '>>> ', current_user, postData[i].uid, privileges[i].editable, privileges[i].collaborate)
          postData[i]['display_moderator_tools'] = (postData[i].uid == current_user || privileges[i].editable) ? 'show' : 'none'
          postData[i]['display_moderator_edit_tools'] = (postData[i].uid == current_user || privileges[i].editable || privileges[i].collaborate) ? 'show' : 'none'

          postData[i].show_banned = postData[i].user_banned === '1' ? 'show' : 'hide'
        }

        callback(postData)
      })
    })
  }

  Topics.getCategoryData = function (cid, current_user, callback) {
    categories.getCategoryData(cid, current_user, callback)
  }

  Topics.getCategoryById = function (cid, current_user, callback) {
    categories.getCategoryById(cid, current_user, callback)
  }

  Topics.getLatestTopics = function (current_user, start, end, term, callback) {
    log.log('debug', 'getLatestTopics', current_user, start, end, term)
    var timestamp = Date.now()

    var terms = {
      day: 86400000,
      week: 604800000,
      month: 2592000000
    }

    var since = terms['day']
    if (terms[term])
      since = terms[term]

    var args = ['topics:recent', '+inf', timestamp - since, 'LIMIT', start, end - start + 1]

    RDB.zrevrangebyscore(args, function (err, tids) {
      var latestTopics = {
        'category_name': 'Recent',
        'show_sidebar': 'hidden',
        'show_topic_button': 'hidden',
        'no_topics_message': 'hidden',
        'topic_row_size': 'col-md-12',
        'category_id': false,
        'topics': []
      }

      if (!tids || !tids.length) {
        latestTopics.no_topics_message = 'show'
        callback(latestTopics)
        return
      }

      Topics.getTopicsByTids(tids, current_user, function (topicData) {
        latestTopics.topics = topicData
        callback(latestTopics)
      })
    })
  }

  Topics.getTotalUnread = function (uid, callback) {
    var unreadTids = [],
      start = 0,
      stop = 21,
      done = false

    async.whilst(
      function () {
        return unreadTids.length < 21 && !done
      },
      function (callback) {
        RDB.zrevrange('topics:recent', start, stop, function (err, tids) {
          if (err)
            return callback(err)

          if (tids && !tids.length) {
            done = true
            return callback(null)
          }

          Topics.hasReadTopics(tids, uid, function (read) {
            var newtids = tids.filter(function (tid, index, self) {
              return read[index] === 0
            })

            unreadTids.push.apply(unreadTids, newtids)

            start = stop + 1
            stop = start + 21
            callback(null)
          })
        })
      },
      function (err) {
        callback({
          count: unreadTids.length
        })
      }
    )
  }

  Topics.getUnreadTopics = function (uid, start, stop, callback) {
    var unreadTopics = {
      'category_name': 'Unread',
      'show_sidebar': 'hidden',
      'show_topic_button': 'hidden',
      'show_markallread_button': 'show',
      'no_topics_message': 'hidden',
      'topic_row_size': 'col-md-12',
      'topics': []
    }

    function noUnreadTopics () {
      unreadTopics.no_topics_message = 'show'
      unreadTopics.show_markallread_button = 'hidden'
      callback(unreadTopics)
    }

    function sendUnreadTopics (topicIds) {
      Topics.getTopicsByTids(topicIds, uid, function (topicData) {
        unreadTopics.topics = topicData
        unreadTopics.nextStart = start + topicIds.length
        if (!topicData || topicData.length === 0)
          unreadTopics.no_topics_message = 'show'
        if (uid === 0 || topicData.length === 0)
          unreadTopics.show_markallread_button = 'hidden'
        callback(unreadTopics)
      })
    }

    var unreadTids = [],
      done = false

    function continueCondition () {
      return unreadTids.length < 20 && !done
    }

    async.whilst(
      continueCondition,
      function (callback) {
        RDB.zrevrange('topics:recent', start, stop, function (err, tids) {
          if (err)
            return callback(err)

          if (tids && !tids.length) {
            done = true
            return callback(null)
          }

          if (uid === 0) {
            unreadTids.push.apply(unreadTids, tids)
            callback(null)
          } else {
            Topics.hasReadTopics(tids, uid, function (read) {
              var newtids = tids.filter(function (tid, index, self) {
                return parseInt(read[index], 10) === 0
              })

              unreadTids.push.apply(unreadTids, newtids)

              if (continueCondition()) {
                start = stop + 1
                stop = start + 19
              }

              callback(null)
            })
          }
        })
      },
      function (err) {
        if (err)
          return callback([])
        if (unreadTids.length)
          sendUnreadTopics(unreadTids)
        else
          noUnreadTopics()

      }
    )
  }

  Topics.getTopicsByTids = function (tids, current_user, callback, category_id) {
    // log.log('debug', 'getTopicsByTids', tids, current_user, category_id)
    var retrieved_topics = []

    if (!Array.isArray(tids) || tids.length === 0) {
      callback(retrieved_topics)
      return
    }

    function getTopicInfo (topicData, callback) {
      function getUserInfo (next) {
        user.getUserFields(topicData.uid, ['username', 'userslug', 'picture'], next)
      }

      function hasReadTopic (next) {
        Topics.hasReadTopic(topicData.tid, current_user, function (hasRead) {
          next(null, hasRead)
        })
      }

      function getTeaserInfo (next) {
        Topics.getTeaser(topicData.tid, function (err, teaser) {
          next(null, teaser || {})
        })
      }

      // temporary. I don't think this call should belong here

      function getPrivileges (next) {
        categories.privileges(category_id, current_user, function (user_privs) {
          next(null, user_privs)
        })
      }

      function getCategoryInfo (next) {
        // CoLearnr - Get raw topic data as well
        categories.getCategoryFields(topicData.cid, ['name', 'slug', 'icon', 'privacy_mode'], function (err, categoryData) {
          try {
            var oid = db.ObjectId('' + topicData.cid)
            db.topics.findOne({_id: oid}, function (err, topic) {
              if (topic) {
                categoryData.raw_topic = topic
                categoryData.privacy_mode = topic.privacy_mode
                categoryData.hidden = topic.hidden
                categoryData.disabled = topic.hidden ? 1 : 0
                categoryData.name = topic.name
                categoryData.description = topic.description
              }
              next(err, categoryData)
            })
          } catch (e) {
            next(err, categoryData)
          }
        })
      }

      async.parallel([getUserInfo, hasReadTopic, getTeaserInfo, getPrivileges, getCategoryInfo], function (err, results) {
        callback({
          username: results[0].username || 'Guest',
          userslug: results[0].userslug || 'guest',
          picture: results[0].picture || '/images/profile/profile_1.jpg',
          userbanned: results[0].banned,
          hasread: results[1],
          teaserInfo: results[2],
          privileges: results[3],
          categoryData: results[4]
        })
      })
    }

    function isTopicVisible (topicData, topicInfo) {
      var deleted = parseInt(topicData.deleted, 10) !== 0
      var ret = !deleted || (deleted && topicInfo.privileges.view_deleted)
      return ret
    }

    function isTopicPrivate (topicData, topicInfo, callback) {
      if (current_user && topicInfo && topicInfo.categoryData && topicInfo.categoryData.raw_topic) {
        db.users.findOne({_id: current_user}, function (err, user) {
          perms_lib.checkTopicViewAccess(user, topicInfo.categoryData.raw_topic, function (err, hasViewAccess) {
            return callback(null, !hasViewAccess)
          })
        })
      } else {
        return callback(null, (topicData.uid != current_user) && (topicData.privacy_mode && topicData.privacy_mode == 'private'))
      }
    }

    function loadTopic (tid, callback) {
      Topics.getTopicData(tid, function (topicData) {
        if (!topicData) {
          return callback(null)
        }

        getTopicInfo(topicData, function (topicInfo) {
          if (!topicInfo) {
            return callback(null)
          }
          topicData['pin-icon'] = topicData.pinned === '1' ? 'icon-pushpin' : 'none'
          topicData['lock-icon'] = topicData.locked === '1' ? 'icon-lock' : 'none'
          topicData['deleted-class'] = topicData.deleted === '1' ? 'deleted' : ''

          topicData.username = topicInfo.username || 'Guest'
          topicData.userslug = topicInfo.userslug || 'guest'
          topicData.picture = topicInfo.picture || '/images/profile/profile_1.jpg'
          if (!topicInfo.categoryData) {
            topicInfo.categoryData = {}
          }
          if (!topicInfo.teaserInfo) {
            topicInfo.teaserInfo = {}
          }
          topicData.categoryIcon = topicInfo.categoryData.icon
          topicData.categoryName = topicInfo.categoryData.name
          topicData.categorySlug = topicInfo.categoryData.slug
          topicData.privacy_mode = topicInfo.categoryData.privacy_mode
          topicData.badgeclass = (topicInfo.hasread && current_user != 0) ? '' : 'badge-important'
          topicData.teaser_text = topicInfo.teaserInfo.text || '',
          topicData.teaser_username = topicInfo.teaserInfo.username || 'Guest'
          topicData.teaser_userslug = topicInfo.teaserInfo.userslug || 'guest'
          topicData.teaser_userpicture = topicInfo.teaserInfo.picture || '/images/profile/profile_1.jpg'
          topicData.teaser_pid = topicInfo.teaserInfo.pid
          topicData.teaser_timestamp = topicInfo.teaserInfo.timestamp ? (new Date(parseInt(topicInfo.teaserInfo.timestamp, 10)).toISOString()) : ''

          if (isTopicVisible(topicData, topicInfo)) {
            isTopicPrivate(topicData, topicInfo, function (err, isPrivate) {
              if (!isPrivate) {
                retrieved_topics.push(topicData)
              } else {
                log.log('debug', 'Filtered topic', current_user, topicData.title)
              }
              callback(null)
            })
          } else {
            callback(null)
          }
        })
      })
    }

    async.eachSeries(tids, loadTopic, function (err) {
      if (!err) {
        callback(retrieved_topics)
      }
    })

  }

  Topics.getTopicWithPosts = function (tid, lbit_oid, current_user, start, end, callback) {
    log.log('debug', 'getTopicWithPosts', tid, lbit_oid, current_user, start, end)
    threadTools.exists(tid, function (exists) {
      if (!exists) {
        return callback(new Error("Topic tid '" + tid + "' not found"))
      }
      Topics.markAsRead(tid, current_user)
      Topics.increaseViewCount(tid)

      function getTopicData (next) {
        Topics.getTopicData(tid, function (topicData) {
          next(null, topicData)
        })
      }

      function getTopicPosts (next) {
        Topics.getTopicPosts(tid, start, end, current_user, function (topicPosts, privileges) {
          next(null, topicPosts)
        })
      }

      function getPrivileges (next) {
        threadTools.privileges(tid, current_user, function (privData) {
          next(null, privData)
        })
      }

      function getCategoryById (next) {
        Topics.getTopicField(tid, 'cid', function (err, cid) {
          Topics.getCategoryById(cid, current_user, next)
        })
      }

      async.parallel([getTopicData, getTopicPosts, getPrivileges, getCategoryById], function (err, results) {
        if (err) {
          log.log('error', err.message)
          callback(err, null)
          return
        }

        var topicData = results[0],
          topicPosts = results[1],
          privileges = results[2],
          categoryData = results[3]

        if (!lbit_oid && topicData.lbit_oid) {
          lbit_oid = topicData.lbit_oid
        }

        var topic_oid = null
        if (util.validOid(categoryData.cid)) {
          topic_oid = categoryData.cid
        }

        function _sendData () {
          var main_posts = topicPosts.splice(0, 1)
          var turl = encodeURIComponent(nconf.get('url') + 'topic/' + topicData.slug)
          shorten_lib.convertUrl(turl, function (err, sturl) {
            // console.log('debug', 'topic_url', turl, sturl, topicData)
            // log.log('info', 'topicData', topicData, lbit_oid)
            // log.log('info', 'categoryData', categoryData, lbit_oid)
            callback(null, {
              'topic_name': topicData.title,
              'lbit_oid': lbit_oid,
              'category_name': categoryData.category_name || categoryData.name,
              'category_slug': categoryData.slug,
              'privacy_mode': categoryData.privacy_mode,
              'locked': topicData.locked,
              'deleted': topicData.deleted,
              'pinned': topicData.pinned,
              'slug': topicData.slug,
              'postcount': topicData.postcount,
              'viewcount': topicData.viewcount,
              'topic_id': tid,
              'expose_tools': privileges.editable ? 1 : 0,
              'posts': topicPosts,
              'main_posts': main_posts,
              'short_url': sturl,
              'lbit_url': (lbit_oid && topic_oid) ? (nconf.get('app_home') + '/topic/' + topic_oid + '#lbit=' + lbit_oid) : '#'
            })
          })
        }
        if (current_user && categoryData && categoryData.raw_topic) {
          db.users.findOne({_id: current_user}, function (err, user) {
            perms_lib.checkTopicViewAccess(user, categoryData.raw_topic, function (err, hasViewAccess) {
              if (!err && !hasViewAccess) {
                callback(err, {error: 'Looks like you don\`t have permission to view this discussion! Please contact support.'})
              } else {
                _sendData()
              }
            })
          })
        } else {
          _sendData()
        }
      })
    })
  }

  Topics.getTopicForCategoryView = function (tid, uid, callback) {
    log.log('debug', 'getTopicForCategoryView', tid, uid)
    function getTopicData (next) {
      Topics.getTopicDataWithUser(tid, function (topic) {
        next(null, topic)
      })
    }

    function getReadStatus (next) {
      if (uid) {
        Topics.hasReadTopic(tid, uid, function (read) {
          next(null, read)
        })
      } else {
        next(null, null)
      }
    }

    function getTeaser (next) {
      Topics.getTeaser(tid, function (err, teaser) {
        if (err) teaser = {}
        next(null, teaser)
      })
    }

    async.parallel([getTopicData, getReadStatus, getTeaser], function (err, results) {
      if (err) {
        callback(null)
        logger.error(err)
      }

      var topicData = results[0],
        hasRead = results[1],
        teaser = results[2]

      topicData.badgeclass = hasRead ? '' : 'badge-important'
      topicData.teaser_text = teaser.text || ''
      topicData.teaser_username = teaser.username || 'Guest'
      topicData.teaser_userslug = teaser.userslug || 'guest'
      topicData.userslug = teaser.userslug || 'guest'
      topicData.teaser_timestamp = teaser.timestamp ? (new Date(parseInt(teaser.timestamp, 10)).toISOString()) : ''
      topicData.teaser_userpicture = teaser.picture || '/images/profile/profile_1.jpg'

      callback(topicData)
    })
  }

  Topics.getAllTopics = function (limit, after, callback) {
    RDB.smembers('topics:tid', function (err, tids) {
      var topics = [],
        numTids, x

      // Sort into ascending order
      tids.sort(function (a, b) {
        return a - b
      })

      // Eliminate everything after the "after" tid
      if (after) {
        for (x = 0, numTids = tids.length; x < numTids; x++) {
          if (tids[x] >= after) {
            tids = tids.slice(0, x)
            break
          }
        }
      }

      if (limit) {
        if (limit > 0 && limit < tids.length) {
          tids = tids.slice(tids.length - limit)
        }
      }

      // Sort into descending order
      tids.sort(function (a, b) {
        return b - a
      })

      async.each(tids, function (tid, next) {
        Topics.getTopicDataWithUser(tid, function (topicData) {
          topics.push(topicData)
          next()
        })
      }, function (err) {
        callback(topics)
      })
    })
  }

  Topics.markAllRead = function (uid, callback) {
    RDB.smembers('topics:tid', function (err, tids) {
      if (err) {
        log.log('info', err)
        callback(err, null)
        return
      }

      if (tids && tids.length) {
        for (var i = 0; i < tids.length; ++i) {
          Topics.markAsRead(tids[i], uid)
        }
      }

      callback(null, true)
    })
  }

  Topics.getTitleByPid = function (pid, callback) {
    posts.getPostField(pid, 'tid', function (tid) {
      Topics.getTopicField(tid, 'title', function (err, title) {
        callback(title)
      })
    })
  }

  Topics.markUnRead = function (tid) {
    RDB.del('tid:' + tid + ':read_by_uid')
  }

  Topics.markAsRead = function (tid, uid) {
    RDB.sadd(schema.topics(tid).read_by_uid, uid)

    Topics.getTopicField(tid, 'cid', function (err, cid) {
      categories.isTopicsRead(cid, uid, function (read) {
        if (read) {
          categories.markAsRead(cid, uid)
        }
      })
    })

    user.notifications.getUnreadByUniqueId(uid, 'topic:' + tid, function (err, nids) {
      if (nids.length > 0) {
        async.each(nids, function (nid, next) {
          Notifications.mark_read(nid, uid, next)
        })
      }
    })
  }

  Topics.hasReadTopics = function (tids, uid, callback) {
    var batch = RDB.multi()

    for (var i = 0, ii = tids.length; i < ii; i++) {
      batch.sismember(schema.topics(tids[i]).read_by_uid, uid)
    }

    batch.exec(function (err, hasRead) {
      callback(hasRead)
    })
  }

  Topics.hasReadTopic = function (tid, uid, callback) {
    RDB.sismember(schema.topics(tid).read_by_uid, uid, function (err, hasRead) {
      if (err === null) {
        callback(hasRead)
      } else {
        log.log('info', err)
        callback(false)
      }
    })
  }

  Topics.getTeasers = function (tids, callback) {
    var teasers = []
    if (Array.isArray(tids)) {
      async.eachSeries(tids, function (tid, next) {
        Topics.getTeaser(tid, function (err, teaser_info) {
          if (err) teaser_info = {}
          teasers.push(teaser_info)
          next()
        })
      }, function () {
        callback(teasers)
      })
    } else callback(teasers)
  }

  Topics.getTeaser = function (tid, callback) {
    threadTools.getLatestUndeletedPid(tid, function (err, pid) {
      if (!err) {
        posts.getPostFields(pid, ['pid', 'content', 'uid', 'timestamp'], function (postData) {
          user.getUserFields(postData.uid, ['username', 'userslug', 'picture'], function (err, userData) {
            if (err)
              return callback(err, null)

            var stripped = postData.content,
              timestamp = postData.timestamp,
              returnObj = {
                'pid': postData.pid,
                'username': userData.username || 'Guest',
                'userslug': userData.userslug || 'guest',
                'picture': userData.picture || '/images/profile/profile_1.jpg',
                'timestamp': timestamp
              }

            if (postData.content) {
              stripped = postData.content.replace(/>.+\n\n/, '')
              postTools.parse(stripped, function (err, stripped) {
                returnObj.text = utils.strip_tags(stripped)
                callback(null, returnObj)
              })
            } else {
              returnObj.text = ''
              callback(null, returnObj)
            }
          })
        })
      } else callback(new Error('no-teaser-found'))
    })
  }

  Topics.emitTitleTooShortAlert = function (socket) {
    socket.emit('event:alert', {
      type: 'danger',
      timeout: 2000,
      title: 'Title too short',
      message: 'Please enter a longer title. At least ' + meta.config.minimumTitleLength + ' characters.',
      alert_id: 'post_error'
    })
  }

  Topics.emitInvalidDiscussion = function (socket) {
    socket.emit('event:alert', {
      type: 'danger',
      timeout: 2000,
      title: 'Invalid discussion',
      message: "We are not able to load that discussion. Perhaps its deleted or you don't have access.",
      alert_id: 'post_error'
    })
  }

  // CoLearnr -
  Topics.getOrCreateTopicByObjId = function (uid, category_id, objid, title, url, content, lbit, callback) {
    log.log('debug', 'getOrCreateTopicByObjId', uid, category_id, objid, title, url)
    Topics.getByObjId(objid, function (err, tid) {
      if (err || !tid) {
        // Create a new topic
        // var uid = 1

        Topics.post(uid, objid, title, content, category_id, lbit.privacy_mode, function (err, postData) {
          if (postData) {
            var tid = postData.tid
            var pid = postData.pid
            // Topics.setTopicField(objid, 'objid', tid)
            RDB.set('topic:objid:' + objid + ':tid', tid)
            log.log('debug', 'getOrCreateTopicByObjId. Created new topic', tid, pid)
            callback(err, tid)
          } else {
            callback(err, null)
          }
        })
      } else {
        callback(err, tid)
      }
    })
  }

  Topics.getByObjId = function (objid, callback) {
    winston.debug('getByObjId', objid)
    RDB.get('topic:objid:' + objid + ':tid', function (err, tid) {
      winston.debug('getByObjId, tid is', tid)
      callback(err, tid)
    })
  }

  Topics.post = function (uid, objid, title, content, category_id, privacy_mode, callback) {
    log.log('debug', 'post', uid, objid, title, category_id, privacy_mode)
    if (!category_id) {
      callback(new Error('no-cid'), null)
      return
    }

    if (content)
      content = content.trim()
    if (title)
      title = title.trim()

    if (uid === 0) {
      callback(new Error('not-logged-in'), null)
      return
    } else if (!title || title.length < meta.config.minimumTitleLength) {
      callback(new Error('title-too-short'), null)
      return
    } else if (!content || content.length < meta.config.miminumPostLength) {
      callback(new Error('content-too-short'), null)
      return
    }

    user.getUserField(uid, 'lastposttime', function (err, lastposttime) {
      if (err) lastposttime = 0
      if (Date.now() - lastposttime < meta.config.postDelay) {
        callback(new Error('too-many-posts'), null)
        return
      }

      RDB.incr(schema.global().next_topic_id, function (err, tid) {
        RDB.handle(err)

        // Global Topics
        if (uid == null) uid = 0
        if (uid !== null) {
          RDB.sadd('topics:tid', tid)
        } else {
          // need to add some unique key sent by client so we can update this with the real uid later
          RDB.lpush(schema.topics().queued_tids, tid)
        }

        var slug = tid + '/' + utils.slugify(title)
        var timestamp = Date.now()
        RDB.hmset('topic:' + tid, {
          'tid': tid,
          'uid': uid,
          'cid': category_id,
          'lbit_oid': objid,
          'title': title,
          'slug': slug,
          'timestamp': timestamp,
          'privacy_mode': privacy_mode || 'public',
          'lastposttime': 0,
          'postcount': 0,
          'viewcount': 0,
          'locked': 0,
          'deleted': 0,
          'pinned': 0
        })

        topicSearch.index(title, tid)

        user.addTopicIdToUser(uid, tid)

        // let everyone know that there is an unread topic in this category
        RDB.del('cid:' + category_id + ':read_by_uid', function (err, data) {
          Topics.markAsRead(tid, uid)
        })

        // in future it may be possible to add topics to several categories, so leaving the door open here.
        RDB.zadd('categories:' + category_id + ':tid', timestamp, tid)
        RDB.hincrby('category:' + category_id, 'topic_count', 1)
        RDB.incr('totaltopiccount')

        // feed.updateCategory(category_id)

        posts.create(uid, tid, content, privacy_mode, function (postData) {
          if (postData) {
            callback(null, postData)
            // Auto-subscribe the post creator to the newly created topic
            threadTools.toggleFollow(tid, uid)

            // Notify any users looking at the category that a new topic has arrived
            Topics.getTopicForCategoryView(tid, uid, function (topicData) {
              io.sockets.in('category_' + category_id).emit('event:new_topic', topicData)
              io.sockets.in('recent_posts').emit('event:new_topic', topicData)
              io.sockets.in('user/' + uid).emit('event:new_post', {
                posts: postData
              })
            })
          } else {
            callback(null, null)
          }
        })
      })
    })
  }

  Topics.getTopicField = function (tid, field, callback) {
    RDB.hget('topic:' + tid, field, callback)
  }

  Topics.getTopicFields = function (tid, fields, callback) {
    RDB.hmgetObject('topic:' + tid, fields, callback)
  }

  Topics.setTopicField = function (tid, field, value) {
    RDB.hset('topic:' + tid, field, value)
  }

  Topics.increasePostCount = function (tid) {
    RDB.hincrby('topic:' + tid, 'postcount', 1)
  }

  Topics.increaseViewCount = function (tid) {
    RDB.hincrby('topic:' + tid, 'viewcount', 1)
  }

  Topics.isLocked = function (tid, callback) {
    Topics.getTopicField(tid, 'locked', function (err, locked) {
      callback(locked)
    })
  }

  Topics.updateTimestamp = function (tid, timestamp) {
    RDB.zadd('topics:recent', timestamp, tid)
    Topics.setTopicField(tid, 'lastposttime', timestamp)
  }

  Topics.addPostToTopic = function (tid, pid) {
    RDB.rpush('tid:' + tid + ':posts', pid)
  }

  Topics.getPids = function (tid, callback) {
    RDB.lrange('tid:' + tid + ':posts', 0, -1, callback)
  }

  Topics.getUids = function (tid, callback) {
    var uids = {}
    Topics.getPids(tid, function (err, pids) {
      function getUid (pid, next) {
        posts.getPostField(pid, 'uid', function (uid) {
          if (err)
            return next(err)
          uids[uid] = 1
          next(null)
        })
      }

      async.each(pids, getUid, function (err) {
        if (err)
          return callback(err, null)

        callback(null, Object.keys(uids))
      })
    })
  }

  Topics.delete = function (tid) {
    Topics.setTopicField(tid, 'deleted', 1)
    RDB.zrem('topics:recent', tid)

    Topics.getTopicField(tid, 'cid', function (err, cid) {
      feed.updateCategory(cid)
      RDB.hincrby('category:' + cid, 'topic_count', -1)
    })
  }

  Topics.restore = function (tid) {
    Topics.setTopicField(tid, 'deleted', 0)
    Topics.getTopicField(tid, 'lastposttime', function (err, lastposttime) {
      RDB.zadd('topics:recent', lastposttime, tid)
    })

    Topics.getTopicField(tid, 'cid', function (err, cid) {
      feed.updateCategory(cid)
      RDB.hincrby('category:' + cid, 'topic_count', 1)
    })
  }

  Topics.reIndexTopic = function (tid, callback) {
    Topics.getPids(tid, function (err, pids) {
      if (err) {
        callback(err)
      } else {
        posts.reIndexPids(pids, function (err) {
          if (err) {
            callback(err)
          } else {
            callback(null)
          }
        })
      }
    })
  }

  Topics.reIndexAll = function (callback) {
    RDB.smembers('topics:tid', function (err, tids) {
      if (err) {
        callback(err, null)
      } else {
        async.each(tids, Topics.reIndexTopic, function (err) {
          if (err) {
            callback(err, null)
          } else {
            callback(null, 'All topics reindexed.')
          }
        })
      }
    })
  }

  Topics._checkDeleteAccess = function (obj, user) {
    if (!obj.hidden || (obj.hidden && (obj.added_by == user._id || (obj.user_role && obj.user_role[user._id] && (obj.user_role[user._id] == constants.TOPIC_ADMIN_ROLE || obj.user_role[user._id] == constants.ADMIN_ROLE))))) {
      return true
    } else {
      return false
    }
  }

  Topics.get_topics = function (user, args, callback) {
    // args['hidden'] = {$ne: true}
    var self = this
    db.topics.find(args).sort({
      path: 1,
      order: 1
    }, function (err, topics) {
      if (err || !topics.length || !user) {
        callback(err, topics)
        return
      }
      var updatedTopics = new Array(topics.length)
      var done = 0
      topics.forEach(function (atopic, index) {
        perms_lib.userTopicRole(user, atopic, function (err, role) {
          if (!err && role) {
            atopic.user_role = role
          }
          // Filter hidden topics based on the user's permission
          if (self._checkDeleteAccess(atopic, user)) {
            perms_lib.allowedPerms(user, atopic, function (err, retMap) {
              if (!err && retMap) {
                atopic.user_perms = retMap[perms_lib.getKey(atopic)]
              // logger.log('debug', 'Added user permissions', atopic.user_perms, 'to', atopic.id)
              }
              updatedTopics[index] = atopic
              done++
              if (done == topics.length) {
                callback(err, _.without(updatedTopics, null))
              }
            })
          } else {
            updatedTopics[index] = null
            done++
            if (done == topics.length) {
              callback(err, _.without(updatedTopics, null))
            }
          }
        })
      })
    })
  }

  Topics.get_first_childs = function (user, parent_path, parent_topic_id, callback) {
    if (!parent_path) {
      parent_path = ','
    }
    // Handle case where the topic is base level topic such as education, leadership
    // var query = {path: {$in: [new RegExp(util.quote_regex(parent_path + parent_topic_id) + ',$'), new RegExp('^,' + util.quote_regex(parent_topic_id) + ',$')]} }
    var query = {
      path: {
        $in: [new RegExp(utils.quote_regex(parent_path + parent_topic_id) + ',$')]
      }
    }
    this.get_topics(user, query, callback)
  }

  Topics.get_random_topics = function (user, count, callback) {
    if (!user) {
      return []
    }
    var orList = []
    if (user && user._id && !user.guestMode) {
      orList.push({added_by: user._id})
      orList.push({collaborators: user._id})
      orList.push({followers: user._id})
    }
    orList.push({privacy_mode: 'public'})

    db.topics.find({$or: orList, hidden: false, path: null, moderation_required: false, safe: true}).limit(count).sort({name: 1}, function (err, topics) {
      if (err) return callback(err, null)
      _processRandomTopics(count, topics, callback)
    })
  }

  function _processRandomTopics (count, topics, callback) {
    var random_topics = []
    if (!topics || !topics.length) {
      callback(null, null)
    }
    var done = 0
    topics.forEach(function (topic, index) {
      Topics.get_first_childs(null, topic.path, topic.id, function (err, child) {
        random_topics[index] = {
          _id: topic._id,
          id: topic.id,
          name: topic.name,
          submenuList: child.slice(0, 8),
          privacy_mode: topic.privacy_mode,
          last_updated: topic.last_updated,
          added_date: topic.added_date
        }
        done++
        if (done == topics.length) {
          callback(null, random_topics)
        }
      })
    })
  }

}(exports))
