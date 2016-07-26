var RDB = require('./redis.js'),
	utils = require('./../public/src/utils.js'),
	schema = require('./schema.js'),
	user = require('./user.js'),
	topics = require('./topics.js'),
	_ = require('lodash'),
	favourites = require('./favourites.js'),
	threadTools = require('./threadTools.js'),
	postTools = require('./postTools'),
	categories = require('./categories'),
	db = require('./db'),
	perms_lib = require('./lib/perms'),
	feed = require('./feed.js'),
	async = require('async'),
	plugins = require('./plugins'),
	reds = require('./reds'),
	postSearch = reds.createSearch('nodebbpostsearch'),
	nconf = require('nconf'),
	NlpLib = require('colearnr-extract-app').Nlp,
	NlpAnalyser = new NlpLib(),
	meta = require('./meta.js'),
	log = require('./log'),
	winston = require('winston');

(function(Posts) {
	var customUserInfo = {};

	Posts.getPostsByTid = function(tid, start, end, callback) {
		//log.log('debug', 'getPostsByTid', tid, start, end);
		RDB.lrange('tid:' + tid + ':posts', start, end, function(err, pids) {
			RDB.handle(err);

			if (pids.length) {
				plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
					if (!err & 0 < posts.length) {
						Posts.getPostsByPids(pids, function(err, posts) {
							plugins.fireHook('action:post.gotTopic', posts);
							let newPosts = []
							posts.forEach(function (post) {
								post.sentimentIcon = post.sentimentIcon || '';
								post.sentimentPolarity = post.sentimentPolarity || '';
								newPosts.push(post);
							});
							callback(newPosts);
						});
					} else {
						let newPosts = []
						posts.forEach(function (post) {
							post.sentimentIcon = post.sentimentIcon || '';
							post.sentimentPolarity = post.sentimentPolarity || '';
							newPosts.push(post);
						});
						callback(newPosts);
					}
				});
			} else {
				callback([]);
			}
		});
	};

	Posts.addUserInfoToPost = function(post, callback) {
		if (!post) {
			return callback();
		}
		user.getUserFields(post.uid, ['username', 'userslug', 'reputation', 'postcount', 'picture', 'signature', 'banned'], function(err, userData) {
			if (err) {
				return callback();
			}

			postTools.parse(userData.signature, function(err, signature) {
				post.username = userData.username || 'Guest';
				post.userslug = userData.userslug || 'guest';
				post.userslugurl = (post.username == 'Guest') ? '#' : '/user/' + post.userslug;
				post.user_dropdown_css = (post.username == 'Guest') ? ' style="display: none;" ' : '';
				post.user_rep = userData.reputation || 0;
				post.user_postcount = userData.postcount || 0;
				post.user_banned = userData.banned || '0';
				post.picture = userData.picture || '/images/profile/profile_1.jpg';
				post.signature = signature;

				for (var info in customUserInfo) {
					if (customUserInfo.hasOwnProperty(info)) {
						post[info] = userData[info] || customUserInfo[info];
					}
				}

				plugins.fireHook('filter:posts.custom_profile_info', {profile: "", uid: post.uid}, function(err, profile_info) {
					post.additional_profile_info = profile_info.profile;

					if (post.editor !== '') {
						user.getUserFields(post.editor, ['username', 'userslug'], function(err, editorData) {
							if (err) return callback();

							post.editorname = editorData.username;
							post.editorslug = editorData.userslug;
							callback();
						});
					} else {
						callback();
					}
				});
			});
		});
	};

	Posts.getPostSummaryByPids = function(pids, callback) {
		//log.log('debug', 'getPostSummaryByPids', pids);
		var posts = [];
		function getPostSummary(pid, callback) {
			async.waterfall([
				function(next) {
					Posts.getPostFields(pid, ['pid', 'tid', 'content', 'uid', 'timestamp', 'deleted', 'privacy_mode'], function(postData) {
						if (postData.deleted === '1') return callback(null);
						else {
							postData.relativeTime = new Date(parseInt(postData.timestamp || 0, 10)).toISOString();
							next(null, postData);
						}
					});
				},
				function(postData, next) {
					Posts.addUserInfoToPost(postData, function() {
						next(null, postData);
					});
				},
				function(postData, next) {
					topics.getTopicFields(postData.tid, ['slug', 'deleted'], function(err, topicData) {
						if (err) return callback(err);
						else if (topicData.deleted === '1') return callback(null);

						postData.topicSlug = topicData.slug;
						next(null, postData);
					});
				},
				function(postData, next) {
					if (postData.content) {
						postTools.parse(postData.content, function(err, content) {
							if (!err) postData.content = utils.strip_tags(content);
							next(err, postData);
						});
					} else next(null, postData);
				}
			], function(err, postData) {
				if (!err) posts.push(postData);
				callback(err);
			});
		}

		async.eachSeries(pids, getPostSummary, function(err) {
			if (!err) {
				callback(null, posts);
			} else {
				callback(err, null);
			}
		});
	};

	// TODO: this function is never called except from some debug route. clean up?
	Posts.getPostData = function(pid, callback) {
		//log.log('debug', 'getPostData', pid);
		RDB.hgetall('post:' + pid, function(err, data) {
			if (err === null) {
				plugins.fireHook('filter:post.get', data, function(err, newData) {
					if (!err) callback(newData);
					else callback(data);
				});
			} else {
				winston.error(err);
			}
		});
	}

	Posts.getPostFields = function(pid, fields, callback) {
		//log.log('debug', 'getPostFields', pid, fields);
		RDB.hmgetObject('post:' + pid, fields, function(err, data) {
			if (err === null) {
				// TODO: I think the plugins system needs an optional 'parameters' paramter so I don't have to do this:
				data = data || {};
				data.pid = pid;
				data.fields = fields;

				plugins.fireHook('filter:post.getFields', data, function(err, data) {
					callback(data);
				});
			} else {
				console.log(err);
			}
		});
	}

	Posts.getPostField = function(pid, field, callback) {
		//log.log('debug', 'getPostField', pid, field);
		RDB.hget('post:' + pid, field, function(err, data) {
			if (err === null) {
				// TODO: I think the plugins system needs an optional 'parameters' paramter so I don't have to do this:
				data = data || {};
				data.pid = pid;
				data.field = field;

				plugins.fireHook('filter:post.getField', data, function(err, data) {
					callback(data);
				});
			} else {
				console.log(err);
			}
		});
	}

	Posts.setPostField = function(pid, field, value, done) {
		//log.log('info', 'Posts.setPostField', pid, field, value);
		RDB.hset('post:' + pid, field, value);
		plugins.fireHook('action:post.setField', {
			'pid': pid,
			'field': field,
			'value': value
		}, done);
	}

	Posts.getPostsByPids = function(pids, callback) {
		//log.log('debug', 'getPostsByPids', pids);
		var posts = [],
			multi = RDB.multi();

		for(var x=0,numPids=pids.length;x<numPids;x++) {
			multi.hgetall("post:"+pids[x]);
		}

		multi.exec(function (err, replies) {
			async.map(replies, function(postData, _callback) {
				if (postData) {

					postData.post_rep = postData.reputation;
					postData['edited-class'] = postData.editor !== '' ? '' : 'none';
					try {
						postData.relativeTime = new Date(parseInt(postData.timestamp,10)).toISOString();
						postData['relativeEditTime'] = postData.edited !== '0' ? (new Date(parseInt(postData.edited,10)).toISOString()) : '';
						postData.sentimentPolarity = postData.sentimentPolarity || '';
						postData.sentimentIcon = postData.sentimentIcon || '';
					} catch(e) {
						winston.err('invalid time value');
					}


					if (postData.uploadedImages) {
						try {
							postData.uploadedImages = JSON.parse(postData.uploadedImages);
						} catch(err) {
							postData.uploadedImages = [];
							winston.err(err);
						}
					} else {
						postData.uploadedImages = [];
					}

                    postTools.parse(postData.content, function(err, content) {
                        postData.content = content;
						_callback(null, postData);
                    });
				} else {
					_callback(null);
				}
			}, function(err, posts) {
				if (!err) {
					return callback(null, posts);
				} else {
					return callback(err, null);
				}
			});
		})
	}

	Posts.get_cid_by_pid = function(pid, callback) {
		Posts.getPostField(pid, 'tid', function(tid) {
			if (tid) {
				topics.getTopicField(tid, 'cid', function(err, cid) {
					if (cid) {
						callback(cid);
					} else {
						callback(false);
					}
				});
			}
		});
	}

	Posts.getCidsForPids= function(pids, callback) {
		var cids = {};
		var done = 0;
		pids.forEach(function(pid) {
			Posts.get_cid_by_pid(pid, function (cid) {
				if (cid) {
					if (!cids[cid]) {
						cids[cid] = [];
					}
					cids[cid].push(pid);
				}
				done++;
				if (done == pids.length) {
					callback(null, cids);
				}
			});
		});
	}

	Posts.emitContentTooShortAlert = function(socket) {
		socket.emit('event:alert', {
			type: 'danger',
			timeout: 2000,
			title: 'Comment too short',
			message: "Please try to add value to this discussion. At least " + meta.config.minimumPostLength + " characters.",
			alert_id: 'post_error'
		});
	}

	Posts.emitTooManyPostsAlert = function(socket) {
		socket.emit('event:alert', {
			title: 'Too many posts!',
			message: 'You can only post every ' + meta.config.postDelay / 1000 + ' seconds.',
			type: 'danger',
			timeout: 2000
		});
	}

	Posts.reply = function(tid, uid, content, privacy_mode, callback) {
		//log.log('debug', 'Posts.reply', uid, tid, privacy_mode);
		if(content) {
			content = content.trim();
		}

		if (!content) {
			callback(new Error('content-too-short'), null);
			return;
		}

		Posts.create(uid, tid, content, privacy_mode, function(postData) {
			if (postData) {
                if(String(postData.content).indexOf("&lt;iframe") > -1 ){
                    var patt = /<a href="(.*?)"/g;
                    while(match=patt.exec(postData.content)){
                        postData.content = '<a href="' +  match[1] + '">' + match[1] + '</a>';
                    }
                }
				topics.markUnRead(tid);
				Posts.get_cid_by_pid(postData.pid, function(cid) {
					RDB.del('cid:' + cid + ':read_by_uid', function(err, data) {
						topics.markAsRead(tid, uid);
					});
				});

				threadTools.notifyFollowers(tid, uid);

				Posts.addUserInfoToPost(postData, function() {
					var socketData = {
						posts: [postData]
					};

					io.sockets.in('topic_' + tid).emit('event:new_post', socketData);
					io.sockets.in('recent_posts').emit('event:new_post', socketData);
					io.sockets.in('user/' + uid).emit('event:new_post', socketData);
				});

				callback(null, 'Reply successful');
			} else {
				callback(new Error('reply-error'), null);
			}
		});
	}

	Posts.create = function(uid, tid, content, privacy_mode, callback) {
		function doProcess(uid, tid, content, privacy_mode, sentimentData, callback) {
			console.log(sentimentData)
			sentimentData = sentimentData.overallScore || {};
			let sentimentIcon = 'fa-meh-o';
			if (sentimentData.valence === 'negative') {
				sentimentIcon = 'fa-frown-o'
			} else if (sentimentData.valence === 'positive') {
				sentimentIcon = 'fa-smile-o'
			}
			sentimentIcon = '<i title="' + sentimentData.valence + '" class="fa ' + sentimentIcon + '"></i>'
			topics.isLocked(tid, function (locked) {
				if (!locked || locked === '0') {
					RDB.incr('global:next_post_id', function (err, pid) {
						RDB.handle(err);

						plugins.fireHook('filter:post.save', content, function (err, newContent) {
							if (!err) content = newContent;

							var timestamp = Date.now(),
								postData = {
									'pid': pid,
									'uid': uid,
									'tid': tid,
									'content': content,
									'timestamp': timestamp,
									'privacy_mode': privacy_mode || 'public',
									'reputation': 0,
									'editor': '',
									'edited': 0,
									'deleted': 0,
									'fav_button_class': '',
									'fav_star_class': 'fa fa-star-o',
									'show_banned': 'hide',
									'relativeTime': new Date(timestamp).toISOString(),
									'post_rep': '0',
									'edited-class': 'none',
									'relativeEditTime': '',
									'sentimentIcon': sentimentIcon,
									'sentimentPolarity': sentimentData.polarity ? '(' + sentimentData.polarity + ')' : ''
								};

							RDB.hmset('post:' + pid, postData);

							topics.addPostToTopic(tid, pid);
							topics.increasePostCount(tid);
							topics.updateTimestamp(tid, timestamp);

							RDB.incr('totalpostcount');

							topics.getTopicFields(tid, [ 'cid', 'pinned' ], function (err, topicData) {

								RDB.handle(err);

								var cid = topicData.cid;

								//feed.updateTopic(tid);

								RDB.zadd('categories:recent_posts:cid:' + cid, timestamp, pid);

								if (topicData.pinned === '0')
									RDB.zadd('categories:' + cid + ':tid', timestamp, tid);

								RDB.scard('cid:' + cid + ':active_users', function (err, amount) {
									if (amount > 10) {
										RDB.spop('cid:' + cid + ':active_users');
									}

									categories.addActiveUser(cid, uid);
								});
							});

							user.onNewPostMade(uid, tid, pid, timestamp);

							async.parallel({
								content: function (next) {
									plugins.fireHook('filter:post.get', postData, function (err, newPostData) {
										if (!err) postData = newPostData;

										postTools.parse(postData.content, function (err, content) {
											next(null, content);
										});
									});
								}
							}, function (err, results) {
								postData.content = results.content;
								callback(postData);
							});

							plugins.fireHook('action:post.save', postData);

							postSearch.index(content, pid);
						});
					});
				} else {
					callback(null);
				}
			});
		}

		if (uid === null) {
			callback(null);
			return;
		}
		if (nconf.get('filterContent')) {
			//log.log('debug', 'filtering', content);
			NlpAnalyser.purifyText(content, null, function(err, filteredContent) {
				//log.log('debug', filteredContent)
				NlpAnalyser.sentiment(content, function (err, sentimentData) {
					doProcess(uid, tid, filteredContent, privacy_mode, sentimentData, callback);
				});
			});
		} else {
			NlpAnalyser.sentiment(content, function (err, sentimentData) {
				//log.log('debug', 'Posts.create', uid, tid, content, privacy_mode);
				doProcess(uid, tid, content, privacy_mode, sentimentData, callback);
			});
		}

	}

	Posts.uploadPostImage = function(image, callback) {
		var imgur = require('./imgur');
		imgur.setClientID(meta.config.imgurClientID);

		if(!image)
			return callback('invalid image', null);

		imgur.upload(image.data, 'base64', function(err, data) {
			if(err) {
				callback('Can\'t upload image!', null);
			} else {
				if(data.success) {
					var img= {url:data.data.link, name:image.name};

					callback(null, img);
				} else {
					winston.error('Can\'t upload image, did you set imgurClientID?');
					callback("upload error", null);
				}
			}
		});
	}

	Posts.getAllowedCids = function(userObj, cids, callback) {
		if (!cids || !cids.length) {
			callback(null, []);
			return;
		}
		// Find valid object ids
		var vcids = [];
		cids.forEach(function (acid) {
			try {
				var id = db.ObjectId(acid);
				vcids.push(id);
			} catch (e) {

			}
		});
		var done = 0;
		var acids = [];
		db.topics.find({_id: {$in: vcids} }, function (err, topics) {
			if (err || !topics) {
				callback(null, []);
			} else {
				topics.forEach(function (atopic) {
					perms_lib.checkTopicViewAccess(userObj, atopic, function (err, isAllowed) {
						done++;
						if (isAllowed) {
							acids.push(atopic._id + '');
						}
						if (done == topics.length) {
							callback(null, acids);
						}
					});
				});
			}
		});
	}

	Posts.getPostsByUid = function(current_user, uid, start, end, callback) {
		db.users.findOne({_id: current_user}, function (err, userObj) {
			user.getPostIds(uid, start, end, function(pids) {
				if (pids && pids.length) {
					plugins.fireHook('filter:post.getTopic', pids, function(err, posts) {
						if (!err & 0 < posts.length) {
							Posts.getCidsForPids(pids, function (err, cidMap) {
								if (!cidMap) {
									callback([]);
								} else {
									var cids = _.keys(cidMap) || [];
									Posts.getAllowedCids(userObj, cids, function (err, acids) {
										var apids = [];
										acids.forEach(function (allowedCid) {
											if (allowedCid && cidMap && cidMap[allowedCid]) {
												apids.push(cidMap[allowedCid]);
											}
										});
										//console.log('>>>', acids, apids);
										Posts.getPostsByPids(apids, function(err, posts) {
											plugins.fireHook('action:post.gotTopic', posts);
											callback(posts);
										});
									});

								}
							});
						} else {
							callback(posts);
						}
					});
				} else {
					callback([]);
				}
			});
		});
	}

	Posts.getTopicPostStats = function(socket) {
		RDB.mget(['totaltopiccount', 'totalpostcount'], function(err, data) {
			if (err === null) {
				var stats = {
					topics: data[0] ? data[0] : 0,
					posts: data[1] ? data[1] : 0
				};
				io.sockets.emit('post.stats', stats);
			} else
				console.log(err);
		});
	}

	Posts.reIndexPids = function(pids, callback) {

		function reIndex(pid, callback) {

			Posts.getPostField(pid, 'content', function(content) {
				postSearch.remove(pid, function() {

					if (content && content.length) {
						postSearch.index(content, pid);
					}
					callback(null);
				});
			});
		}

		async.each(pids, reIndex, function(err) {
			if (err) {
				callback(err, null);
			} else {
				callback(null, 'Posts reindexed');
			}
		});
	}

	Posts.getFavourites = function(uid, callback) {
		RDB.zrevrange('uid:' + uid + ':favourites', 0, -1, function(err, pids) {
			if (err)
				return callback(err, null);

			Posts.getPostSummaryByPids(pids, function(err, posts) {
				if (err)
					return callback(err, null);

				callback(null, posts);
			});

		});
	}

}(exports));
