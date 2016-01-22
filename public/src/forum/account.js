define(['forum/accountheader'], function(header) {
	var Account = {};

	Account.init = function() {
		header.init();
		Account.intervalId = 0;
		Account.isOnline = false;
		var yourid = templates.get('yourid'),
			theirid = templates.get('theirid'),
			isFollowing = templates.get('isFollowing');

		$(document).ready(function() {
			$('.topic-row').expander({
				slicePoint: 800,
				expandText: 'Read more',
				userCollapseText: 'Collapse',
			});
			var username = $('.account-username a').html();
			app.enter_room('user/' + theirid);

			app.addCommasToNumbers();

			var followBtn = $('#follow-btn');
			var unfollowBtn = $('#unfollow-btn');
			var chatBtn = $('#chat-btn');

			if (yourid !== theirid && yourid !== "0") {
				if (isFollowing) {
					followBtn.hide();
					unfollowBtn.show();
				} else {
					followBtn.show();
					unfollowBtn.hide();
				}
			} else {
				chatBtn.hide();
				followBtn.hide();
				unfollowBtn.hide();
			}

			followBtn.on('click', function() {
				socket.emit('api:user.follow', {
					uid: theirid
				}, function(success) {
					if (success) {
						followBtn.hide();
						unfollowBtn.show();
						app.alertSuccess('You are now following ' + username + '!');
					} else {
						app.alertError('There was an error following' + username + '!');
					}
				});
				return false;
			});

			unfollowBtn.on('click', function() {
				socket.emit('api:user.unfollow', {
					uid: theirid
				}, function(success) {
					if (success) {
						followBtn.show();
						unfollowBtn.hide();
						app.alertSuccess('You are no longer following ' + username + '!');
					} else {
						app.alertError('There was an error unfollowing ' + username + '!');
					}
				});
				return false;
			});

			$('.user-recent-posts .topic-row').on('click', function() {
				ajaxify.go($(this).attr('topic-url'));
			});

			socket.on('api:user.isOnline', Account.handleUserOnline);

			socket.emit('api:user.isOnline', theirid, Account.handleUserOnline);

			socket.on('event:new_post', function(data) {
				if (data && data.posts && data.posts.uid) {
					if (data.posts.uid == yourid) {
						var html = templates.prepare(templates['account'].blocks['posts']).parse(data);
						$('.user-recent-posts').prepend(html);
					}
				}
			});

		});
	};

	Account.handleUserOnline = function(data) {
		//var onlineStatus = $('.account-online-status');
		var yourid = templates.get('yourid'),
			theirid = templates.get('theirid');
		var username = $('.account-username a').html();

		if (yourid != theirid) {
			if (data.online && !Account.isOnline) {
				Account.isOnline = true;
				//onlineStatus.find('span').html('<a id="chat-btn" href="#" class="btn btn-default"><i class="fa fa-circle"></i> Chat</a>');
				var chatBtn = $('#chat-btn');
				chatBtn.on('click', function() {
					if (username === app.username || !app.username)
						return;

					app.openChat(username, theirid);
					return false;
				});

			} else if (!data.online && Account.isOnline) {
				Account.isOnline = false;
				//onlineStatus.find('span').html('<a id="chat-btn" href="#" class="btn disabled"><i class="fa fa-circle-o"></i> Away</a>');
			}
			//checkOnlineStatus(theirid);
		}

	};

	function checkOnlineStatus(theirid) {
		if(Account.intervalId === 0) {
			Account.intervalId = setInterval(function() {
				socket.emit('api:user.isOnline', theirid, Account.handleUserOnline);
			}, 5000);
		}
	}

	return Account;
});
