var RDB = require('./redis.js'),
	posts = require('./posts.js'),
	topics = require('./topics'),
	categories = require('./categories'),
	threadTools = require('./threadTools.js'),
	user = require('./user.js'),
	async = require('async'),
	nconf = require('nconf'),
	validator = require('validator'),

	utils = require('../public/src/utils'),
	plugins = require('./plugins'),
	reds = require('reds'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	topicSearch = reds.createSearch('nodebbtopicsearch'),
	winston = require('winston'),
	meta = require('./meta.js'),
	log = require('./log'),
	Feed = require('./feed');

(function(PostTools) {
	PostTools.isMain = function(pid, tid, callback) {
		RDB.lrange('tid:' + tid + ':posts', 0, 0, function(err, pids) {
			if (pids[0] === pid) callback(true);
			else callback(false);
		})
	}

	PostTools.privileges = function(pid, uid, callback) {
		// log.log('debug', 'PostTools.privileges', pid, uid);
		if(!uid) {
			callback({
				editable: false,
				view_deleted: false
			});
			return;
		}

		function getCategoryPrivileges(next) {
			posts.getPostField(pid, 'tid', function(tid) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
					categories.privileges(cid, uid, function(privileges) {
						log.log();
						next(null, privileges);
					});
				});
			});
		}

		function isOwnPost(next) {
			posts.getPostField(pid, 'uid', function(author) {
				// log.log('debug', 'PostTools.isOwnPost', pid, uid, author);
				next(null, author == uid);
			});
		}

		function hasEnoughRep(next) {
			user.getUserField(uid, 'reputation', function(err, reputation) {
				if (err) return next(null, false);
				// log.log('debug', 'PostTools.hasEnoughRep', uid, reputation, meta.config['privileges:manage_content']);
				var minReputationNeeded = meta.config['privileges:manage_content'] || 1000;
				next(null, parseInt(reputation, 10) >= minReputationNeeded);
			});
		}

		async.parallel([getCategoryPrivileges, isOwnPost, hasEnoughRep], function(err, results) {
			// log.log('debug', 'results', pid, uid, results);
			callback({
				editable: results[0].editable || results[1] || results[2],
				collaborate: results[0].collaborate,
				view_deleted: results[0].view_deleted || results[1] || results[2]
			});
		});
	}


	PostTools.edit = function(uid, pid, title, content) {
		// log.log('debug', 'PostTools.edit', uid, pid, title, content);
		var	success = function() {
			async.waterfall([
				function(next) {
					posts.setPostField(pid, 'edited', Date.now());
					next(null);
				},
				function(next) {
					posts.setPostField(pid, 'editor', uid);
					next(null);
				},
				function(next) {
					posts.setPostField(pid, 'content', content);
					next(null);
				}
			]);

			// log.log('debug', 'PostTools.edit', 'Updating search index for pid', pid);
			postSearch.remove(pid, function() {
				postSearch.index(content, pid);
			});

			// log.log('debug', 'async.parallel');
			async.parallel([
				function(next) {
					// log.log('debug', 'async.parallel first fn');
					posts.getPostField(pid, 'tid', function(tid) {
						PostTools.isMain(pid, tid, function(isMainPost) {
							// log.log('debug', 'async.parallel isMainPost', isMainPost);
							if (isMainPost) {
								topics.setTopicField(tid, 'title', title);
								topicSearch.remove(tid, function() {
									topicSearch.index(title, tid);
								});
							}

							next(null, {
								tid: tid,
								isMainPost: isMainPost
							});
						});
					});
				},
				function(next) {
					// log.log('debug', 'call parse');
					PostTools.parse(content, next);
				}
			], function(err, results) {
				// log.log('debug', 'emit event edited' + results[0]);
				io.sockets.in('topic_' + results[0].tid).emit('event:post_edited', {
					pid: pid,
					title: validator.escape(title),
					isMainPost: results[0].isMainPost,
					content: results[1]
				});
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			// log.log('debug', 'PostTools.privileges', privileges);
			if (privileges.editable || privileges.collaborate) {
				plugins.fireHook('filter:post.save', content, function(err, parsedContent) {
					if (!err) content = parsedContent;
					success();
				});
			}
		});
	}

	PostTools.delete = function(uid, pid, callback) {
		// log.log('debug', 'PostTools.delete', uid, pid);
		var success = function() {
			posts.setPostField(pid, 'deleted', 1);
			RDB.decr('totalpostcount');
			postSearch.remove(pid);

			posts.getPostFields(pid, ['tid', 'uid'], function(postData) {
				RDB.hincrby('topic:' + postData.tid, 'postcount', -1);

				user.decrementUserFieldBy(postData.uid, 'postcount', 1, function(err, postcount) {
					RDB.zadd('users:postcount', postcount, postData.uid);
				});

				io.sockets. in ('topic_' + postData.tid).emit('event:post_deleted', {
					pid: pid
				});

				// Delete the thread if it is the last undeleted post
				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					if (err && err.message === 'no-undeleted-pids-found') {
						threadTools.delete(postData.tid, -1, function(err) {
							if (err) winston.error('Could not delete topic (tid: ' + postData.tid + ')', err.stack);
						});
					} else {
						posts.getPostField(pid, 'timestamp', function(timestamp) {
							topics.updateTimestamp(postData.tid, timestamp);
						});
					}
				});

				//Feed.updateTopic(postData.tid);

				callback();
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			log.log('info', 'PostTools.privileges', privileges);
			if (privileges.editable) {
				success();
			}
		});
	}

	PostTools.restore = function(uid, pid, callback) {
		var success = function() {
			posts.setPostField(pid, 'deleted', 0);
			RDB.incr('totalpostcount');

			posts.getPostFields(pid, ['tid', 'uid', 'content'], function(postData) {
				RDB.hincrby('topic:' + postData.tid, 'postcount', 1);

				user.incrementUserFieldBy(postData.uid, 'postcount', 1);

				io.sockets. in ('topic_' + postData.tid).emit('event:post_restored', {
					pid: pid
				});

				threadTools.getLatestUndeletedPid(postData.tid, function(err, pid) {
					posts.getPostField(pid, 'timestamp', function(timestamp) {
						topics.updateTimestamp(postData.tid, timestamp);
					});
				});

				// Restore topic if it is the only post
				topics.getTopicField(postData.tid, 'postcount', function(err, count) {
					if (count === '1') {
						threadTools.restore(postData.tid, uid);
					}
				});

				//Feed.updateTopic(postData.tid);

				postSearch.index(postData.content, pid);

				callback();
			});
		};

		PostTools.privileges(pid, uid, function(privileges) {
			if (privileges.editable) {
				success();
			}
		});
	}

	PostTools.parse = function(raw, callback) {
		//log.log('info', 'PostTools.parse', raw);
		raw = raw || '';

		plugins.fireHook('filter:post.parse', raw, function(err, parsed) {
			callback(null, !err ? parsed : raw);
		});
	}


}(exports));
