var cookie = require('cookie'),
  express = require('express'),
  user = require('./user.js'),
  Groups = require('./groups'),
  posts = require('./posts.js'),
  db = require('./db.js'),
  favourites = require('./favourites.js'),
  utils = require('../public/src/utils.js'),
  util = require('util'),
  topics = require('./topics.js'),
  categories = require('./categories.js'),
  notifications = require('./notifications.js'),
  threadTools = require('./threadTools.js'),
  postTools = require('./postTools.js'),
  meta = require('./meta.js'),
  async = require('async'),
  session = require('express-session'),
  RedisStoreLib = require('connect-redis')(session),
  ioRedisStore = require('socket.io/lib/stores/redis'),
  RDB = require('./redis'),
  util = require('util'),
  logger = require('./logger.js'),
  log = require('./log'),
  fs = require('fs'),
  _ = require('lodash'),
  RedisStore = new RedisStoreLib({
    client: RDB,
    ttl: 60 * 60 * 24 * 14
  }),
  nconf = require('nconf'),
  cookieParser = require('cookie-parser'),
  socketCookieParser = cookieParser(nconf.get('secret')),
  admin = {
    'categories': require('./admin/categories.js'),
    'user': require('./admin/user.js')
  },
  plugins = require('./plugins'),
  winston = require('winston')

var users = {},
  userSockets = {},
  rooms = {}

module.exports.logoutUser = function (uid) {
  if (userSockets[uid] && userSockets[uid].length) {
    for (var i = 0; i < userSockets[uid].length; ++i) {
      userSockets[uid][i].emit('event:disconnect')
      userSockets[uid][i].disconnect()

      if (!userSockets[uid])
        return
    }
  }
}

function isUserOnline (uid, callback) {
  // var ret = !!userSockets[uid] && userSockets[uid].length > 0
  RDB.zscore('users:online', uid, function (err, score) {
    // log.log('debug', "isUserOnline", uid, score != null)
    callback(null, score != null)
  })
}
module.exports.isUserOnline = isUserOnline

module.exports.getOnlineAnonCount = function () {
  return userSockets[0] ? userSockets[0].length : 0
}

function configure (uid, userSockets, sessionID, socket, lastPostTime) {
  log.log('debug', 'websockets configure', uid, sessionID, lastPostTime)
  if (!uid && !sessionID) {
    log.log('debug', 'There is no uid or sessionid!')
  }

  if (uid) {
    userSockets[uid] = userSockets[uid] || []
    userSockets[uid].push(socket)

    /* Need to save some state for the logger & maybe some other modules later on */
    socket.state = {
      user: {
        uid: uid
      }
    }

    /* If meta.config.loggerIOStatus > 0, logger.io_one will hook into this socket */
    logger.io_one(socket, uid)

    RDB.zadd('users:online', Date.now(), uid, function (err, data) {
      socket.join('uid_' + uid)
      db.users.findOne({_id: uid}, function (err, userObj) {
        if (userObj) {
          socket.emit('event:connect', {
            status: 1,
            username: userObj.displayName,
            uid: uid
          })
        }
      })
    })

    isUserOnline(uid, function (err, isUOnline) {
      io.sockets.in('global').emit('api:user.isOnline', isUOnline)
      log.log('info', uid, 'is online now!')
    })
  }

  socket.on('disconnect', function () {
    if (!userSockets || !userSockets[uid]) {
      return
    }
    var index = userSockets[uid].indexOf(socket)
    if (index !== -1) {
      userSockets[uid].splice(index, 1)
    }

    if (userSockets[uid].length === 0) {
      delete users[sessionID]
      delete userSockets[uid]
    }

    if (uid) {
      RDB.zrem('users:online', uid, function (err, data) {})
    }
    isUserOnline(uid, function (err, isUOnline) {
      io.sockets.in('global').emit('api:user.isOnline', isUOnline)
    })

    emitOnlineUserCount()

    for (var roomName in rooms) {
      socket.leave(roomName)

      if (rooms[roomName][socket.id]) {
        delete rooms[roomName][socket.id]
      }

      updateRoomBrowsingText(roomName)
    }
  })

  socket.on('api:get_all_rooms', function (data) {
    socket.emit('api:get_all_rooms', io.sockets.manager.rooms)
  })

  function updateRoomBrowsingText (roomName) {
    function getUidsInRoom (room) {
      var uids = []
      for (var socketId in room) {
        if (uids.indexOf(room[socketId]) === -1)
          uids.push(room[socketId])
      }
      return uids
    }

    function getAnonymousCount (roomName) {
      var clients = io.sockets.clients(roomName)
      var anonCount = 0

      for (var i = 0; i < clients.length; ++i) {
        var hs = clients[i].handshake
        if (hs && !clients[i].state.user.uid) {
          ++anonCount
        }
      }
      return anonCount
    }

    var uids = getUidsInRoom(rooms[roomName])

    var anonymousCount = 0

    if (uids.length === 0) {
      io.sockets.in(roomName).emit('api:get_users_in_room', { users: [], anonymousCount: 0 })
    } else {
      user.getMultipleUserFields(uids, ['uid', 'username', 'userslug', 'picture'], function (err, users) {
        if (!err)
          io.sockets.in(roomName).emit('api:get_users_in_room', { users: users, anonymousCount: anonymousCount })
      })
    }
  }

  socket.on('event:enter_room', function (data) {
    if (data.leave !== null) {
      socket.leave(data.leave)
    }

    socket.join(data.enter)

    rooms[data.enter] = rooms[data.enter] || {}

    if (uid) {
      rooms[data.enter][socket.id] = uid

      if (data.leave && rooms[data.leave] && rooms[data.leave][socket.id]) {
        delete rooms[data.leave][socket.id]
      }
    }

    if (data.leave)
      updateRoomBrowsingText(data.leave)

    updateRoomBrowsingText(data.enter)

    if (data.enter != 'admin')
      io.sockets.in('admin').emit('api:get_all_rooms', io.sockets.manager.rooms)

  })

  // BEGIN: API calls (todo: organize)

  socket.on('api:updateHeader', function (data) {
    // log.log('debug', 'api:updateHeader', uid, data)
    if (uid) {
      user.getUserFields(uid, data.fields, function (err, fields) {
        if (!err && fields) {
          fields.uid = uid
          socket.emit('api:updateHeader', fields)
        }
      })
    } else {
      socket.emit('api:updateHeader', {
        uid: 0,
        username: 'Guest',
        email: '',
        picture: '/images/profile/profile_1.jpg'
      })
    }

  })

  socket.on('user.exists', function (data) {
    // log.log('debug', 'user.exists', uid, data)
    if (data.username) {
      user.exists(utils.slugify(data.username), function (exists) {
        socket.emit('user.exists', {
          exists: exists
        })
      })
    }
  })

  socket.on('user.count', function (data) {
    user.count(socket, data)
  })

  socket.on('post.stats', function (data) {
    posts.getTopicPostStats()
  })

  socket.on('user.latest', function (data) {
    user.latest(socket, data)
  })

  socket.on('user.email.exists', function (data) {
    user.email.exists(socket, data.email)
  })

  socket.on('user:reset.send', function (data) {
    user.reset.send(socket, data.email)
  })

  socket.on('user:reset.valid', function (data) {
    user.reset.validate(socket, data.code)
  })

  socket.on('user:reset.commit', function (data) {
    user.reset.commit(socket, data.code, data.password)
  })

  socket.on('api:user.get_online_users', function (data) {
    var returnData = []
    var done = 0
    for (var i = 0; i < data.length; ++i) {
      var uid = data[i]

      isUserOnline(uid, function (err, isUOnline) {
        returnData.push(uid)
        done++
        if (done == i) {
          socket.emit('api:user.get_online_users', returnData)
        }
      })
    }
  })

  socket.on('api:user.isOnline', function (uid, callback) {
    isUserOnline(uid, function (err, isUOnline) {
      callback({
        online: isUOnline,
        uid: uid,
        timestamp: Date.now()
      })
    })
  })

  socket.on('api:user.changePassword', function (data, callback) {
    user.changePassword(uid, data, callback)
  })

  socket.on('api:user.updateProfile', function (data, callback) {
    user.updateProfile(uid, data, callback)
  })

  socket.on('api:user.changePicture', function (data, callback) {
    var type = data.type

    function updateHeader () {
      user.getUserFields(uid, ['picture'], function (err, fields) {
        if (!err && fields) {
          fields.uid = uid
          socket.emit('api:updateHeader', fields)
          callback(true)
        } else {
          callback(false)
        }
      })
    }

    if (type === 'gravatar') {
      user.getUserField(uid, 'gravatarpicture', function (err, gravatar) {
        user.setUserField(uid, 'picture', gravatar)
        updateHeader()
      })
    } else if (type === 'uploaded') {
      user.getUserField(uid, 'uploadedpicture', function (err, uploadedpicture) {
        user.setUserField(uid, 'picture', uploadedpicture)
        updateHeader()
      })
    } else {
      callback(false)
    }
  })

  socket.on('api:user.follow', function (data, callback) {
    if (uid) {
      user.follow(uid, data.uid, callback)
    }
  })

  socket.on('api:user.unfollow', function (data, callback) {
    if (uid) {
      user.unfollow(uid, data.uid, callback)
    }
  })

  socket.on('api:user.saveSettings', function (data, callback) {
    if (uid) {
      user.setUserFields(uid, {
        showemail: data.showemail
      })
      callback(true)
    }
  })

  socket.on('api:topics.post', function (data) {
    log.log('debug', 'on topics.post', uid, data.title, data.content, data.category_id)
    topics.post(uid, null, data.title, data.content, data.category_id, 'public', function (err, result) {
      if (err) {
        if (err.message === 'not-logged-in') {
          socket.emit('event:alert', {
            title: 'Thank you for posting',
            message: 'Since you are unregistered, your post is awaiting approval. Click here to register now.',
            type: 'warning',
            timeout: 7500,
            clickfn: function () {
              ajaxify.go('register')
            }
          })
        } else if (err.message === 'title-too-short') {
          topics.emitTitleTooShortAlert(socket)
        } else if (err.message === 'content-too-short') {
          posts.emitContentTooShortAlert(socket)
        } else if (err.message === 'too-many-posts') {
          posts.emitTooManyPostsAlert(socket)
        } else if (err.message === 'no-cid') {
          topics.emitInvalidDiscussion(socket)
        }
        return
      }

      if (result) {
        posts.getTopicPostStats()

        socket.emit('event:alert', {
          title: 'Thank you for posting',
          message: 'You have successfully created a new discussion post.',
          type: 'success',
          timeout: 2000
        })
      }
    })

  })

  socket.on('api:topics.markAllRead', function (data, callback) {
    topics.markAllRead(uid, function (err, success) {
      if (!err && success) {
        callback(true)
      } else {
        callback(false)
      }
    })
  })

  socket.on('api:posts.reply', function (data) {
    if (uid < 1 && meta.config.allowGuestPosting === '0') {
      socket.emit('event:alert', {
        title: 'Reply Unsuccessful',
        message: 'You don&apos;t seem to be logged in, so you cannot reply.',
        type: 'danger',
        timeout: 2000
      })
      return
    }

    if (Date.now() - lastPostTime < meta.config.postDelay) {
      posts.emitTooManyPostsAlert(socket)
      return
    }
    log.log('debug', 'on posts.reply', uid, 'cat', data.category_id, 'topic', data.topic_id, data.content)

    posts.reply(data.topic_id, uid, data.content, 'public', function (err, result) {
      if (err) {
        if (err.message === 'content-too-short') {
          posts.emitContentTooShortAlert(socket)
        } else if (err.message === 'too-many-posts') {
          posts.emitTooManyPostsAlert(socket)
        } else if (err.message === 'reply-error') {
          socket.emit('event:alert', {
            title: 'Reply Unsuccessful',
            message: 'Your reply could not be posted at this time. Please try again later.',
            type: 'warning',
            timeout: 2000
          })
        }
        return
      }

      if (result) {
        lastPostTime = Date.now()
        posts.getTopicPostStats()

        if (data.category_id) {
          topics.getTopicData(data.topic_id, function (topicData) {
            // console.log(topicData)
            if (topicData && topicData.lbit_oid) {
              // console.log('broadcast', topicData.postcount, 'to lbit:', topicData.lbit_oid)
              socket.broadcast.to('lbit:' + topicData.lbit_oid).emit('api:set_counts', {lbit_id: topicData.lbit_oid, postcount: topicData.postcount, viewcount: topicData.viewcount})
            }
          })
        }
      }

    })
  })

  socket.on('api:user.getOnlineAnonCount', function (data, callback) {
    callback(module.exports.getOnlineAnonCount())
  })

  function emitOnlineUserCount () {
    var anon = userSockets[0] ? userSockets[0].length : 0
    var registered = Object.keys(userSockets).length
    if (anon)
      registered = registered - 1

    var returnObj = {
      users: registered + anon,
      anon: anon
    }
    io.sockets.emit('api:user.active.get', returnObj)
  }

  socket.on('api:user.active.get', function () {
    emitOnlineUserCount()
  })

  socket.on('api:posts.favourite', function (data) {
    favourites.favourite(data.pid, data.room_id, uid, socket)
  })

  socket.on('api:posts.unfavourite', function (data) {
    favourites.unfavourite(data.pid, data.room_id, uid, socket)
  })

  socket.on('api:topic.delete', function (data) {
    threadTools.delete(data.tid, uid, function (err) {
      if (!err) {
        posts.getTopicPostStats()
        socket.emit('api:topic.delete', {
          status: 'ok',
          tid: data.tid
        })
      }
    })
  })

  socket.on('api:topic.restore', function (data) {
    threadTools.restore(data.tid, uid, socket, function (err) {
      posts.getTopicPostStats()

      socket.emit('api:topic.restore', {
        status: 'ok',
        tid: data.tid
      })
    })
  })

  socket.on('api:topic.lock', function (data) {
    threadTools.lock(data.tid, uid, socket)
  })

  socket.on('api:topic.unlock', function (data) {
    threadTools.unlock(data.tid, uid, socket)
  })

  socket.on('api:topic.pin', function (data) {
    threadTools.pin(data.tid, uid, socket)
  })

  socket.on('api:topic.unpin', function (data) {
    threadTools.unpin(data.tid, uid, socket)
  })

  socket.on('api:topic.move', function (data) {
    threadTools.move(data.tid, data.cid, socket)
  })

  socket.on('api:categories.get', function () {
    categories.getAllCategories(function (categories) {
      socket.emit('api:categories.get', categories)
    })
  })

  socket.on('api:posts.uploadImage', function (data, callback) {
    posts.uploadPostImage(data, callback)
  })

  socket.on('api:posts.getRawPost', function (data) {
    posts.getPostField(data.pid, 'content', function (raw) {
      socket.emit('api:posts.getRawPost', {
        post: raw
      })
    })
  })

  socket.on('api:posts.edit', function (data) {
    log.log('debug', 'api:posts.edit', data)
    if (!uid) {
      socket.emit('event:alert', {
        title: 'Can&apos;t edit',
        message: 'Guests can&apos;t edit posts!',
        type: 'warning',
        timeout: 2000
      })
      return
    } else if (!data.title || data.title.length < topics.minimumTitleLength) {
      topics.emitTitleTooShortAlert(socket)
      return
    } else if (!data.content || data.content.length < require('../public/config.json').minimumPostLength) {
      posts.emitContentTooShortAlert(socket)
      return
    }

    postTools.edit(uid, data.pid, data.title, data.content, data.images)
  })

  socket.on('api:posts.delete', function (data) {
    log.log('debug', 'api:posts.delete', data)
    postTools.delete(uid, data.pid, function () {
      posts.getTopicPostStats()
    })
  })

  socket.on('api:posts.restore', function (data) {
    postTools.restore(uid, data.pid, function () {
      posts.getTopicPostStats()
    })
  })

  socket.on('api:notifications.get', function (data, callback) {
    log.log('debug', 'api:notifications.get', data)
    user.notifications.get(uid, function (notifs) {
      callback(notifs)
    })
  })

  socket.on('api:notifications.mark_read', function (nid) {
    notifications.mark_read(nid, uid)
  })

  socket.on('api:notifications.mark_all_read', function (data, callback) {
    notifications.mark_all_read(uid, function (err) {
      if (!err) callback()
    })
  })

  socket.on('api:categories.getRecentReplies', function (tid) {
    categories.getRecentReplies(tid, 4, function (replies) {
      socket.emit('api:categories.getRecentReplies', replies)
    })
  })

  socket.on('getChatMessages', function (data, callback) {
    var touid = data.touid
    require('./messaging').getMessages(uid, touid, function (err, messages) {
      if (err)
        return callback(null)

      callback(messages)
    })
  })

  socket.on('sendChatMessage', function (data) {
    log.log('debug', 'sendChatMessage', data)
    var touid = data.touid
    if (touid === uid || uid === 0) {
      return
    }

    var msg = utils.strip_tags(data.message)

    user.getUserField(uid, 'username', function (err, username) {
      var finalMessage = username + ' : ' + msg,
        notifText = 'New message from <strong>' + username + '</strong>'

      isUserOnline(touid, function (err, isUOnline) {
        if (!isUOnline) {
          notifications.create(notifText, 'javascript:app.openChat(&apos;' + username + '&apos;, ' + uid + ');', 'notification_' + uid + '_' + touid, function (nid) {
            notifications.push(nid, [touid], function (success) {})
          })
        }

        require('./messaging').addMessage(uid, touid, msg, function (err, message) {
          var numSockets = 0

          if (userSockets[touid]) {
            numSockets = userSockets[touid].length

            for (var x = 0; x < numSockets; ++x) {
              userSockets[touid][x].emit('chatMessage', {
                fromuid: uid,
                username: username,
                message: finalMessage,
                timestamp: Date.now()
              })
            }
          }

          if (userSockets[uid]) {
            numSockets = userSockets[uid].length

            for (var x = 0; x < numSockets; ++x) {
              userSockets[uid][x].emit('chatMessage', {
                fromuid: touid,
                username: username,
                message: 'You : ' + msg,
                timestamp: Date.now()
              })
            }
          }
        })
      })
    })
  })

  socket.on('api:config.get', function (data) {
    meta.configs.list(function (err, config) {
      if (!err) socket.emit('api:config.get', config)
    })
  })

  socket.on('api:config.set', function (data) {
    meta.configs.set(data.key, data.value, function (err) {
      if (!err) {
        socket.emit('api:config.set', {
          status: 'ok'
        })

        plugins.fireHook('action:config.set', {
          key: data.key,
          value: data.value
        })
      }

      logger.monitorConfig(this, data)
    })
  })

  socket.on('api:config.remove', function (key) {
    meta.configs.remove(key)
  })

  socket.on('api:composer.push', function (data) {
    log.log('debug', 'api:composer.push', uid, data)
    // log.log('debug', 'Checking if uid', uid, 'sessionid', sessionID, 'is still online')
    user.getUidBySession(sessionID, function (uidFromDB) {
      winston.info('UID from DB', uidFromDB, ' local uid:', uid)
      if (!uidFromDB) {
        socket.emit('disconnect')
        socket.emit('api:composer.push', {
          error: 'no-uid'
        })
      } else if (uid) {
        if (data.tid) {
          topics.getTopicData(data.tid, function (topicData) {
            if (data.body) {
              topicData.body = data.body
            }

            socket.emit('api:composer.push', {
              tid: data.tid,
              category_id: topicData.cid,
              isReply: true,
              title: topicData.title,
              body: topicData.body
            })
          })
        } else if (data.cid) {
          user.getUserFields(uid, ['username', 'picture'], function (err, userData) {
            if (!err && userData) {
              socket.emit('api:composer.push', {
                tid: 0,
                isPost: true,
                cid: data.cid,
                category_id: data.cid,
                username: userData.username,
                picture: userData.picture,
                title: undefined
              })
            }
          })
        } else if (data.pid) {
          async.parallel([
            function (next) {
              posts.getPostFields(data.pid, ['content'], function (raw) {
                next(null, raw)
              })
            },
            function (next) {
              topics.getTitleByPid(data.pid, function (title) {
                next(null, title)
              })
            }
          ], function (err, results) {
            socket.emit('api:composer.push', {
              title: results[1],
              pid: data.pid,
              category_id: null,
              isEdit: true,
              body: results[0].content
            })
          })
        }
      } else {
        socket.emit('api:composer.push', {
          error: 'no-uid'
        })
      }
    })
  })

  socket.on('api:composer.editCheck', function (pid) {
    posts.getPostField(pid, 'tid', function (tid) {
      postTools.isMain(pid, tid, function (isMain) {
        socket.emit('api:composer.editCheck', {
          titleEditable: isMain
        })
      })
    })
  })

  socket.on('api:post.privileges', function (pid) {
    postTools.privileges(pid, uid, function (privileges) {
      privileges.pid = parseInt(pid)
      socket.emit('api:post.privileges', privileges)
    })
  })

  socket.on('api:topic.followCheck', function (tid) {
    threadTools.isFollowing(tid, uid, function (following) {
      socket.emit('api:topic.followCheck', following)
    })
  })

  socket.on('api:topic.follow', function (tid) {
    log.log('debug', 'api:topic.follow', uid, tid)
    if (uid) {
      threadTools.toggleFollow(tid, uid, function (follow) {
        if (follow.status === 'ok') socket.emit('api:topic.follow', follow)
      })
    } else {
      socket.emit('api:topic.follow', {
        status: 'error',
        error: 'not-logged-in'
      })
    }
  })

  socket.on('api:topic.loadMore', function (data, callback) {
    // log.log('debug', 'api:topic.loadMore', uid, data)
    var start = data.after,
      end = start + 9

    topics.getTopicPosts(data.tid, start, end, uid, function (posts) {
      callback({
        posts: posts
      })
    })
  })

  socket.on('api:category.loadMore', function (data, callback) {
    log.log('debug', 'api:category.loadMore', uid, data)
    var start = data.after,
      end = start + 9

    categories.getCategoryTopics(data.cid, start, end, uid, function (topics) {
      callback({
        topics: topics
      })
    })
  })

  socket.on('api:topics.loadMoreRecentTopics', function (data, callback) {
    var start = data.after,
      end = start + 9

    topics.getLatestTopics(uid, start, end, data.term, function (latestTopics) {
      callback(latestTopics)
    })
  })

  socket.on('api:topics.loadMoreUnreadTopics', function (data, callback) {
    var start = data.after,
      end = start + 9

    topics.getUnreadTopics(uid, start, end, function (unreadTopics) {
      callback(unreadTopics)
    })
  })

  socket.on('api:users.loadMore', function (data, callback) {
    // log.log('debug', 'api:users.loadMore', uid, data)
    var start = data.after,
      end = start + 19

    user.getUsers(data.set, start, end, function (err, data) {
      if (err) {
        winston.err(err)
      } else {
        callback({
          users: data
        })
      }
    })
  })

  socket.on('api:admin.topics.getMore', function (data, callback) {
    topics.getAllTopics(data.limit, data.after, function (topics) {
      callback(JSON.stringify(topics))
    })
  })

  socket.on('api:admin.categories.create', function (data, callback) {
    admin.categories.create(data, function (err, data) {
      callback(err, data)
    })
  })

  socket.on('api:admin.categories.update', function (data) {
    admin.categories.update(data, socket)
  })

  socket.on('api:admin.user.makeAdmin', function (theirid) {
    if (uid) {
      admin.user.makeAdmin(uid, theirid, socket)
    }
  })

  socket.on('api:admin.user.removeAdmin', function (theirid) {
    if (uid) {
      admin.user.removeAdmin(uid, theirid, socket)
    }
  })

  socket.on('api:admin.user.deleteUser', function (theirid) {
    if (uid) {
      admin.user.deleteUser(uid, theirid, socket)
    }
  })

  socket.on('api:admin.user.banUser', function (theirid) {
    if (uid) {
      admin.user.banUser(uid, theirid, socket, function (isBanned) {
        if (isBanned) {
          if (userSockets[theirid]) {
            for (var i = 0; i < userSockets[theirid].length; ++i) {
              userSockets[theirid][i].emit('event:banned')
            }
          }
          module.exports.logoutUser(theirid)
        }
      })
    }
  })

  socket.on('api:admin.user.unbanUser', function (theirid) {
    if (uid) {
      admin.user.unbanUser(uid, theirid, socket)
    }
  })

  socket.on('api:admin.user.search', function (username, callback) {
    log.log('debug', 'api:admin.user.search', username)
    if (uid) {
      user.search(username, function (data) {
        if (!callback) socket.emit('api:admin.user.search', data)
        else callback(null, data)
      })
    } else {
      if (!callback) socket.emit('api:admin.user.search', null)
      else callback()
    }
  })

  socket.on('api:admin.themes.getInstalled', function (callback) {
    meta.themes.get(function (err, themeArr) {
      callback(themeArr)
    })
  })

  socket.on('api:admin.plugins.toggle', function (plugin_id) {
    plugins.toggleActive(plugin_id, function (status) {
      socket.emit('api:admin.plugins.toggle', status)
    })
  })

  socket.on('api:meta.buildTitle', function (text, callback) {
    meta.title.build(text, uid, function (err, title, numNotifications) {
      callback(title, numNotifications)
    })
  })

  /*
  	GROUPS
  */

  socket.on('api:groups.create', function (data, callback) {
    Groups.create(data.name, data.description, function (err, groupObj) {
      callback(err ? err.message : null, groupObj || undefined)
    })
  })

  socket.on('api:groups.delete', function (gid, callback) {
    Groups.destroy(gid, function (err) {
      callback(err ? err.message : null, err ? null : 'OK')
    })
  })

  socket.on('api:groups.get', function (gid, callback) {
    Groups.get(gid, {
      expand: true
    }, function (err, groupObj) {
      callback(err ? err.message : null, groupObj || undefined)
    })
  })

  socket.on('api:groups.join', function (data, callback) {
    Groups.join(data.gid, data.uid, callback)
  })

  socket.on('api:groups.leave', function (data, callback) {
    Groups.leave(data.gid, data.uid, callback)
  })

  socket.on('api:groups.update', function (data, callback) {
    Groups.update(data.gid, data.values, function (err) {
      callback(err ? err.message : null)
    })
  })

  socket.on('api:admin.theme.set', meta.themes.set)

  /**
   * Webapp specific events
   */
  socket.on('send:poll_vote', function (voteObj) {
    if (voteObj && voteObj.lbit) {
      db.learnbits.findOne({_id: db.ObjectId(voteObj.lbit)}, function (err, lbit) {
        if (lbit) {
          var user_voted = false
          if (lbit.votes && _.indexOf(lbit.votes, uid) != -1) {
            user_voted = true
          }
          socket.emit('api:poll_myvote', {lbit: lbit, locals: {}, body: utils.parseJson(lbit.body), voted_by: {_id: uid, guestMode: (uid == null || uid == 0)}})
          socket.broadcast.to('lbit:' + lbit._id).emit('api:poll_vote', {lbit: lbit, locals: {}, body: utils.parseJson(lbit.body), voted_by: {_id: uid, guestMode: (uid == null || uid == 0)}})
        }
      })
    }
  })

  socket.on('send:newlbit', function (lbit_data) {
    // log.log('debug', 'newlbit', lbit_data)
    if (lbit_data && lbit_data.data && lbit_data.topic) {
      socket.broadcast.to('topic:' + lbit_data.topic._id).emit('api:newlbit', lbit_data)
    }
  })

  socket.on('send:dellbit', function (lbit_data) {
    // log.log('debug', 'dellbit', lbit_data)
    if (lbit_data && lbit_data.data && lbit_data.topic) {
      socket.broadcast.to('topic:' + lbit_data.topic._id).emit('api:dellbit', lbit_data)
      socket.broadcast.to('lbit:' + lbit_data.data).emit('api:dellbit', lbit_data)
    }
  })

  socket.on('send:editlbit', function (lbit_data) {
    // log.log('debug', 'editlbit', lbit_data)
    if (lbit_data && lbit_data.lbit && lbit_data.lbit.topics) {
      socket.broadcast.to('lbit:' + lbit_data.lbit._id).emit('api:editlbit', lbit_data)
    }
  })

  socket.on('send:addAnnotation', function (annotation_data) {
    if (annotation_data.lbit_id) {
      socket.broadcast.to('lbit:' + annotation_data.lbit_id).emit('api:addAnnotation', annotation_data)
    }
  })

  socket.on('send:updateAnnotation', function (annotation_data) {
    if (annotation_data.lbit_id) {
      socket.broadcast.to('lbit:' + annotation_data.lbit_id).emit('api:updateAnnotation', annotation_data)
    }
  })

  socket.on('send:deleteAnnotation', function (annotation_data) {
    if (annotation_data.lbit_id) {
      socket.broadcast.to('lbit:' + annotation_data.lbit_id).emit('api:deleteAnnotation', annotation_data)
    }
  })

  socket.on('send:topic_tree', function (tree_data) {
    var rootTopic = null
    if (tree_data && tree_data.rootTopic) {
      rootTopic = tree_data.rootTopic
    }
    if (tree_data && rootTopic && rootTopic._id) {
      socket.broadcast.to('topic:' + tree_data.rootTopic._id).emit('api:topic_tree', tree_data)
    }
  })

  socket.on('api:join_room', function (room) {
    log.log('debug', 'join_room', room)
    socket.join(room)
  })

  socket.on('api:leave_room', function (room) {
    log.log('debug', 'leave_room', room)
    socket.leave(room)
  })

} // configure

module.exports.configure = configure

module.exports.init = function (io) {
  global.io = io
  io.configure(function () {
    // io.enable('browser client etag')          // apply etag caching logic based on version number
    var ioLogLevel = (process.env.NODE_ENV === 'development') ? 3 : 2
    io.set('log level', ioLogLevel) // reduce logging
    io.set('transports', [
      'websocket'
      , 'xhr-polling'
      , 'jsonp-polling'
      , 'flashsocket'
      , 'htmlfile'
    ])

    var redis = require('redis')
    var pub = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'))
    var sub = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'))
    var store = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'))
    pub.on('error', function (err) {})
    sub.on('error', function (err) {})
    store.on('error', function (err) {})
    var db = parseInt(nconf.get('redis:database'), 10)
    if (db != null) {
      pub.select(db, function (error) {
        sub.select(db, function (error) {
          store.select(db, function (error) {
            io.set('store', new ioRedisStore({
              redisPub: pub,
              redisSub: sub,
              redisClient: store
            }))
          })
        })
      })
    }
  })

  io.sockets.on('connection', function (socket) {
    var hs = socket.handshake,
      sessionID, uid, lastPostTime = 0
    // Validate the session, if present
    socketCookieParser(hs, {}, function (err) {
      sessionID = socket.handshake.signedCookies['connect.sid-' + (process.env.ENV_CONFIG || 'dev')]
      RedisStore.get(sessionID, function (err, sessionData) {
        var uid = users[sessionID] = 0
        // log.log('info', 'session id and Data', sessionID, sessionData)
        var transportName = (io && io.transports && socket && socket.id && io.transports[socket.id]) ? io.transports[socket.id].name : ''
        // log.log('info', 'connection with uid', uid, 'session', sessionID, 'using transport', transportName)
        if (!uid) {
          user.getUidBySession(sessionID, function (userId) {
            if (userId) {
              // log.log('debug', userId)
              user.getOrCreateUser(userId, function (err, uid) {
                // log.log('debug', 'uid', uid)
                configure(uid, userSockets, sessionID, socket, lastPostTime)
              })
            } else {
              configure(uid, userSockets, sessionID, socket, lastPostTime)
            }
          })
        } else {
          configure(uid, userSockets, sessionID, socket, lastPostTime)
        }
      })
    })

  })

}
