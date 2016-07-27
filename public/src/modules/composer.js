define(['taskbar'], function(taskbar) {
	var composer = {
		initialized: false,
		active: undefined,
		taskbar: taskbar,
		posts: {},
		postContainer: undefined,
	};

	var uploadsInProgress = [];
	var needToConfirm = false;
	var lastUUID = null;
	var anchor = null;
	//window.onbeforeunload = confirmExit;

	if ($.receiveMessage) {
		$.receiveMessage(function (msg) {
			if (msg && msg.data) {
				try {
					tmpanchor = JSON.parse(msg.data);
					if (tmpanchor.lbit_id) {
						anchor = tmpanchor;
					}
				} catch (e) {

				}
			}
		});
	}

	var formatTime = function(secs) {
		if (!secs || isNaN(parseInt(secs, 10))) {
			return "";
		}
		var hh = Math.floor(secs / 3600);
		var mm = Math.floor((secs - (hh * 3600))/60);
		var ss = secs - (hh * 3600) - (mm * 60);

		if (hh < 10) {hh = '0' + hh}
			if (mm < 10) {mm = '0' + mm}
				if (ss < 10) {ss = '0' + ss}

					if (hh == '00') {
						return mm + ':' + ss;
					} else {
						return hh + ':' + mm + ':' + ss;
					}
				};

				function formatPage(page) {
					if (page && !isNaN(parseInt(page, 10))) {
						return 'Page ' + page;
					}
				}
				function confirmExit() {
					if (needToConfirm) {
						var summernoteEditor = $("[data-edit=summernote]");
						if (summernoteEditor && summernoteEditor.length) {
							try {
								var bodyVal = summernoteEditor.code();
								if (bodyVal && bodyVal.length > 1 && bodyVal != '<p><br></p>' && bodyVal != '<br>' && bodyVal != '<p></p>') {
									return "You are attempting to leave without posting your comment. Are you sure?"
								}
							} catch (e) {

							}
						}
					}
				}

				function renderHTML(text) {
					if (text) {
						text = text.replace(new RegExp('(<p><br></p>)*$'), '');
						text = text.replace(new RegExp('(<p></p>)*$'), '');
					}
					return text;
				}

				function createImagePlaceholder(img) {
					var text = $('.post-window textarea').val(),
					textarea = $('.post-window textarea'),
					imgText = "!["+img.name+"](uploading...)";

					text += imgText;
					textarea.val(text + " ");
					uploadsInProgress.push(1);
					socket.emit("api:posts.uploadImage", img, function(err, data) {

						var currentText = textarea.val();
						imgText = "!["+data.name+"](uploading...)";

						if(!err)
							textarea.val(currentText.replace(imgText, "!["+data.name+"]("+data.url+")"));
						else
							textarea.val(currentText.replace(imgText, "!["+data.name+"](upload error)"));
						uploadsInProgress.pop();
					});
				}

				function loadFile(file) {
					var reader = new FileReader(),
					dropDiv = $('.post-window .imagedrop'),
					uuid = dropDiv.parents('[data-uuid]').attr('data-uuid');

					$(reader).on('loadend', function(e) {
						var bin = this.result;
						bin = bin.split(',')[1];

						var img = {
							name: file.name,
							data: bin
						};

						createImagePlaceholder(img);

						dropDiv.hide();
					});

					reader.readAsDataURL(file);
				}

				function initializeFileReader() {
					jQuery.event.props.push( "dataTransfer" );

					var draggingDocument = false;

					if(window.FileReader) {
						var drop = $('.post-window .imagedrop'),
						textarea = $('.post-window textarea');

						$(document).on('dragstart', function(e) {
							draggingDocument = true;
						}).on('dragend', function(e) {
							draggingDocument = false;
						});

						textarea.on('dragenter', function(e) {
							if(draggingDocument)
								return;
							drop.css('top', textarea.position().top + 'px');
							drop.show();

							drop.on('dragleave', function(ev) {
								drop.hide();
								drop.off('dragleave');
							});
						});

						function cancel(e) {
							e.preventDefault();
							return false;
						}

						drop.on('dragover', cancel);
						drop.on('dragenter', cancel);

						drop.on('drop', function(e) {
							e.preventDefault();
							var uuid = drop.parents('[data-uuid]').attr('data-uuid'),
							dt = e.dataTransfer,
							files = dt.files;

							for (var i=0; i<files.length; i++) {
								loadFile(files[i]);
							}

							if(!files.length)
								drop.hide();
							return false;
						});
					}
				}

				composer.init = function() {
					if (!composer.initialized) {
						var taskbar = document.getElementById('taskbar');

						composer.postContainer = document.createElement('div');
						composer.postContainer.className = 'post-window';
						composer.postContainer.innerHTML =	'<div class="post-div">' +
            '<input type="text" class="commenttitle hide" tabIndex="1" placeholder="Enter your topic title here..." />' +
						'<textarea id="commentarea" class="commentarea" data-edit="summernote" data-chat="true" tabIndex="2"></textarea>' +
						'<div id="div_start"><button id="start_button" onclick="startButton(event)" title="Voice comment"><img  alt="Voice comment" id="start_img" src="/images/mic.gif"></button></div>' +
						'</div>';

						document.body.insertBefore(composer.postContainer, taskbar);
						socket.on('api:composer.push', function(threadData) {
							if (!threadData.error) {
								var uuid = utils.generateUUID();
								if (lastUUID) {
									composer.discard(lastUUID);
								}
								composer.taskbar.push('composer', uuid, {
									title: (!threadData.cid ? (threadData.title || '') : 'New Topic'),
									icon: threadData.picture
								});

								var defaultBody = '';
								if (anchor && anchor.lbit_id != null && anchor.topic_id != null) {
									if (anchor.currentTime) {
										defaultBody = '<a class="btn btn-default" href="#t=' + anchor.currentTime + '">' + formatTime(anchor.currentTime) + '</a>&nbsp; ';
									} else if (anchor.currentPage) {
										defaultBody = '<a class="btn btn-default" href="#p=' + anchor.currentPage + '">' + formatPage(anchor.currentPage) + '</a>&nbsp; ';
									}
								}
								composer.posts[uuid] = {
									tid: threadData.tid,
									cid: threadData.cid,
									category_id: threadData.category_id,
									pid: threadData.pid,
									title: threadData.title || '',
									body: threadData.body || defaultBody,
									modified: false
								};
								composer.load(uuid);
								lastUUID = uuid;
							} else {
								app.alert({
									type: 'danger',
									timeout: 5000,
									alert_id: 'post_error',
									title: 'Please Log In',
									message: 'Posting is currently restricted to registered members only, click here to log in',
									clickfn: function() {
										ajaxify.go('login');
									}
								});
							}
						});

			socket.on('api:composer.editCheck', function(editCheck) {
				if (editCheck.titleEditable === true) composer.postContainer.querySelector('input').readOnly = false;
			});

			// Post Window events
			var	jPostContainer = $(composer.postContainer),
			postContentEl = composer.postContainer.querySelector('textarea');

			jPostContainer.on('change', 'input, textarea', function() {
				var uuid = $(this).parents('.post-window')[0].getAttribute('data-uuid');
				if (this.nodeName === 'INPUT') composer.posts[uuid].title = this.value;
				else if (this.nodeName === 'TEXTAREA') composer.posts[uuid].body = this.value;
				// Mark this post window as having been changed
				composer.posts[uuid].modified = true;
			});
      jPostContainer.on('keyup', '.note-editable', function(e) {
        if (e.which === 13 && !e.shiftKey) {
          var uuid = $(this).parents('.post-window').attr('data-uuid');
          composer.post(uuid);
        }
      });
			jPostContainer.on('click', '.action-bar button', function() {
				var	action = this.getAttribute('data-action'),
				uuid = $(this).parents('.post-window').attr('data-uuid');
				switch(action) {
					case 'post': composer.post(uuid); break;
					case 'minimize': composer.minimize(uuid); break;
					case 'discard':
					composer.discard(uuid);
					break;
				}
			});
			window.addEventListener('resize', function() {
				if (composer.active !== undefined) composer.reposition(composer.active);
			});
			summernoteEditorInit();
			composer.initialized = true;
		}
	}

	composer.push = function(tid, cid, pid, text) {
		socket.emit('api:composer.push', {
			tid: tid,	// Replying
			cid: cid,	// Posting
			pid: pid,	// Editing
			body: text	// Predefined text
		});
	}

	composer.load = function(post_uuid) {
		var post_data = composer.posts[post_uuid],
		titleEl = composer.postContainer.querySelector('input'),
		bodyEl = composer.postContainer.querySelector('textarea');

		composer.reposition(post_uuid);
		composer.active = post_uuid;

		composer.postContainer.setAttribute('data-uuid', post_uuid);
		if (post_data.tid) {
			titleEl.value = 'Replying to: ' + post_data.title;
			titleEl.readOnly = true;
			$(titleEl).addClass('hidden-sm').addClass('hidden-xs');
		} else if (post_data.pid) {
			titleEl.value = post_data.title;
			titleEl.readOnly = true;
			$(titleEl).addClass('hidden-sm').addClass('hidden-xs');
			socket.emit('api:composer.editCheck', post_data.pid);
		} else {
			titleEl.value = post_data.title;
			titleEl.readOnly = false;
			$(titleEl).removeClass('hidden-sm').removeClass('hidden-xs');
		}

		//bodyEl.value = post_data.body;
		$('#commentarea').code(post_data.body);

		// Direct user focus to the correct element
		if (post_data.cid) {
			titleEl.focus();
		} else {
			$('.note-editable').get(0).focus();
		}
		$('.topic-main-buttons').addClass('compose-mode');
		$('html, body').animate({ scrollTop: $('.topic-main-buttons').offset().top});
	}

	composer.reposition = function(post_uuid) {
		var postWindowEl = composer.postContainer.querySelector('.post-div'),
		taskbarBtn = document.querySelector('#taskbar [data-uuid="' + post_uuid + '"]'),
		btnRect = taskbarBtn.getBoundingClientRect(),
		taskbarRect = document.getElementById('taskbar').getBoundingClientRect(),
		windowRect, leftPos;

		composer.postContainer.style.display = 'block';
		windowRect = postWindowEl.getBoundingClientRect();
		leftPos = btnRect.left + btnRect.width - windowRect.width;
		//postWindowEl.style.left = (leftPos > 0 ? leftPos : 30) + 'px';
		postWindowEl.style.right = '0px';
		//composer.postContainer.style.bottom = (taskbarRect.height || -60) + "px";
		composer.postContainer.style.bottom = "0px";
	}

	composer.post = function(post_uuid) {
		// Check title and post length
		var postData = composer.posts[post_uuid],
		titleEl = composer.postContainer.querySelector('input'),
		bodyEl = composer.postContainer.querySelector('textarea');
		titleEl.value = titleEl.value.trim();
		//bodyEl.value = bodyEl.value.trim();
		var summernoteEditor = $("[data-edit=summernote]");
		var bodyVal = summernoteEditor.code();

    var EMPTY_VALUES = ['', '<br>', '&nbsp;', '<div><br></div><div><br></div>', '<div><br></div>'];
    if (!bodyVal || EMPTY_VALUES.indexOf(bodyVal) !== -1) {
      return;
    }

		if(uploadsInProgress.length) {
			return app.alert({
				type: 'warning',
				timeout: 2000,
				title: 'Still uploading',
				message: "Please wait for uploads to complete.",
				alert_id: 'post_error'
			});
		}

		// Still here? Let's post.
		if (postData.cid) {
			socket.emit('api:topics.post', {
				'title' : titleEl.value,
				'content' : renderHTML(bodyVal),
				'category_id' : postData.cid,
				'anchor': anchor
			});
		} else if (postData.tid) {
			socket.emit('api:posts.reply', {
				'topic_id' : postData.tid,
				'category_id' : postData.category_id,
				'content' : renderHTML(bodyVal),
				'anchor': anchor
			});
		} else if (postData.pid) {
			socket.emit('api:posts.edit', {
				'pid': postData.pid,
				'content': renderHTML(bodyVal),
				'category_id' : postData.category_id,
				'title': titleEl.value,
				'anchor': anchor
			});
		}

		composer.clear(post_uuid);
	}

	composer.clear = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$(composer.postContainer).find('.imagedrop').hide();
			uploadsInProgress.length = 0;
			var summernoteEditor = $("[data-edit=summernote]");
			summernoteEditor.code('&nbsp;');
			$('.note-editable').get(0).focus();
		}
	}

	composer.discard = function(post_uuid) {
		if (composer.posts[post_uuid]) {
			$(composer.postContainer).find('.imagedrop').hide();
			delete composer.posts[post_uuid];
			uploadsInProgress.length = 0;
			composer.minimize();
			taskbar.discard('composer', post_uuid);
			var summernoteEditor = $("[data-edit=summernote]");
			summernoteEditor.code("");
			$('.topic-main-buttons').removeClass('compose-mode');
		}
	}

	composer.minimize = function(uuid) {
		if (composer.posts && composer.posts[uuid]) {
			var summernoteEditor = $("[data-edit=summernote]");
			composer.posts[uuid].body = summernoteEditor.code();
			composer.posts[uuid].modified = true;
		}
		composer.postContainer.style.display = 'none';
		composer.active = undefined;
		taskbar.minimize('composer', uuid);
		$('.topic-main-buttons').removeClass('compose-mode');
	}

	composer.init();

	return {
		push: composer.push,
		load: composer.load,
		minimize: composer.minimize
	};
});
