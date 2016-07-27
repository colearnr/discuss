(function() {
	var stats_users = document.getElementById('stats_users'),
		stats_topics = document.getElementById('stats_topics'),
		stats_posts = document.getElementById('stats_posts'),
		stats_online = document.getElementById('stats_online'),
		user_label = document.getElementById('user_label');

	socket.emit('user.count', {});
	socket.on('user.count', function(data) {
		if (stats_users) {
			stats_users.innerHTML = data.count;
		}
	});

	socket.emit('post.stats');
	socket.on('post.stats', function(data) {
		if (stats_topics) {
			stats_topics.innerHTML = data.topics;
		}
		if (stats_posts) {
			stats_posts.innerHTML = data.posts;
		}
	});

	socket.emit('api:user.active.get');
	socket.on('api:user.active.get', function(data) {
		if (stats_online) {
			stats_online.innerHTML = data.users;
		}
	});

	socket.emit('api:updateHeader', {
		fields: ['username', 'picture', 'userslug']
	});

	socket.on('api:updateHeader', function(data) {
		jQuery('#search-button').on('click', function() {
			jQuery('#search-fields').removeClass('hide').show();
			jQuery(this).hide();
			jQuery('#search-fields input').focus()

			jQuery('#search-form').on('submit', function() {
				jQuery('#search-fields').hide();
				jQuery('#search-button').show();
			});

			$('#search-fields input').on('blur', function() {
				$('#search-fields').hide();
				$('#search-button').show();
			});
		});

		var loggedInMenu = $('#logged-in-menu'),
			isLoggedIn = (data.uid && data.uid != "0");

		if (isLoggedIn) {
			jQuery('.discuss-loggedin').show();
			jQuery('.discuss-loggedout').hide();

			$('#logged-out-menu').addClass('hide');
			$('#logged-in-menu').removeClass('hide');

			$('#search-button').show();

			var userLabel = loggedInMenu.find('#user_label');
			if (userLabel.length) {
				if (data['userslug'])
					userLabel.find('#user-profile-link').attr('href', '/user/' + data['userslug']);
				if (data['picture'])
					userLabel.find('img').attr('src', data['picture']);
				if (data['username'])
					userLabel.find('span').html(data['username']);

				$('#logout-link').on('click', function() {
					var	csrf_token = $('#csrf_token').val();

					$.post(RELATIVE_PATH + '/logout', {
						_csrf: csrf_token
					}, function() {
						window.location = RELATIVE_PATH + '/';
					});
				});
			}
		} else {
			$('#search-button').hide();

			jQuery('.discuss-loggedin').hide();
			jQuery('.discuss-loggedout').show();

			$('#logged-out-menu').removeClass('hide');
			$('#logged-in-menu').addClass('hide');

		}

		$('#main-nav a,#right-menu a').off('click').on('click', function() {
			if($('.navbar .navbar-collapse').hasClass('in'))
				$('.navbar-header button').click();
		});
	});

	// Notifications dropdown
	var notifEle = document.getElementsByClassName('notifications');
	if (notifEle && notifEle[0]) {
		var notifContainer = notifEle[0],
			notifTrigger = notifContainer.querySelector('a'),
			notifList = document.getElementById('notif-list'),
			notifIcon = document.querySelector('.notifications a i');
		notifTrigger.addEventListener('click', function(e) {
			e.preventDefault();
			if (notifContainer.className.indexOf('open') === -1) {
				socket.emit('api:notifications.get', null, function(data) {
					var notifFrag = document.createDocumentFragment(),
						notifEl = document.createElement('li'),
						numRead = data.read.length,
						numUnread = data.unread.length,
						x;
					notifList.innerHTML = '';
					if ((data.read.length + data.unread.length) > 0) {
						for (x = 0; x < numUnread; x++) {
							notifEl.setAttribute('data-nid', data.unread[x].nid);
							notifEl.className = 'unread';
							notifEl.innerHTML = '<a href="' + data.unread[x].path + '"><span class="pull-right">' + utils.relativeTime(data.unread[x].datetime, true) + '</span>' + data.unread[x].text + '</a>';
							notifFrag.appendChild(notifEl.cloneNode(true));
						}
						for (x = 0; x < numRead; x++) {
							notifEl.setAttribute('data-nid', data.read[x].nid);
							notifEl.className = '';
							notifEl.innerHTML = '<a href="' + data.read[x].path + '"><span class="pull-right">' + utils.relativeTime(data.read[x].datetime, true) + '</span>' + data.read[x].text + '</a>';
							notifFrag.appendChild(notifEl.cloneNode(true));
						}
					} else {
						notifEl.innerHTML = '<a>You have no notifications</a>';
						notifFrag.appendChild(notifEl);
					}
					notifList.appendChild(notifFrag);

					if (data.unread.length > 0) notifIcon.className = 'fa fa-circle active';
					else notifIcon.className = 'fa fa-circle-o';

					socket.emit('api:notifications.mark_all_read', null, function() {
						notifIcon.className = 'fa fa-circle-o';
						utils.refreshTitle();
					});
				});
			}
		});

		notifList.addEventListener('click', function(e) {
			var target;
			switch (e.target.nodeName) {
				case 'SPAN':
					target = e.target.parentNode.parentNode;
					break;
				case 'A':
					target = e.target.parentNode;
					break;
				case 'li':
					target = e.target;
					break;
			}
			if (target) {
				var nid = parseInt(target.getAttribute('data-nid'));
				if (nid > 0) socket.emit('api:notifications.mark_read', nid);
			}
		});
	}

	require(['mobileMenu'], function(mobileMenu) {
		mobileMenu.init();
	});
}());
