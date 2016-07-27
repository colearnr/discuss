<input type="hidden" template-variable="expose_tools" value="{expose_tools}" />
<input type="hidden" template-variable="topic_id" value="{topic_id}" />
<input type="hidden" template-variable="locked" value="{locked}" />
<input type="hidden" template-variable="deleted" value="{deleted}" />
<input type="hidden" template-variable="pinned" value="{pinned}" />
<input type="hidden" template-variable="topic_name" value="{topic_name}" />
<input type="hidden" template-variable="postcount" value="{postcount}" />
<input type="hidden" template-variable="short_url" value="{short_url}" />

<div class="topic row">
	<ol class="breadcrumb">
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
		</li>
		<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<a href="/category/{category_slug}" itemprop="url"><span itemprop="title">{category_name}</span></a>
		</li>
		<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
			<span itemprop="title">{topic_name}</span> &nbsp;<a href="{lbit_url}" title="Back to the learnbit"> <i class="fa fa-external-link"></i></a>
		</li>
		<div class="thread_active_users active-users pull-right"></div>
	</ol>

	<ul id="post-container" class="" data-tid="{topic_id}">
		<!-- BEGIN main_posts -->
			<a id="post_anchor_{main_posts.pid}" name="{main_posts.pid}"></a>
			<li class="post-row main-post" data-pid="{main_posts.pid}" data-uid="{main_posts.uid}" data-username="{main_posts.username}" data-deleted="{main_posts.deleted}" itemscope itemtype="http://schema.org/Article">
				<div>
					<div class="post-block">
						<meta itemprop="datePublished" content="{main_posts.relativeTime}">
						<meta itemprop="dateModified" content="{main_posts.relativeEditTime}">
						<meta itemprop="url" content="/topic/{slug}/">
						<a class="avatar" href="{main_posts.userslugurl}">
							<img itemprop="image" title="{main_posts.username}" src="{main_posts.picture}" align="left" class="img-circle" width="80px" height="80px" /><br />
						</a>
						<h3>
							<p id="topic_title_{main_posts.pid}" class="topic-title" itemprop="name">{topic_name}</p>
						</h3>

						<div class="topic-buttons">
							<div class="btn-group">
								<button class="btn btn-sm btn-default follow" type="button" title="Follow this discussion"><i class="fa fa-eye"></i> Follow</button>
								<button class="favourite btn btn-sm btn-default {main_posts.fav_button_class}" type="button">
									<span class="favourite-text"></span>
									<span class="post_rep_{main_posts.pid}">{main_posts.post_rep} </span><i class="{main_posts.fav_star_class}"></i>
								</button>
								<button class="btn btn-sm btn-primary btn post_reply" type="button">[[topic:reply]]</button>
							</div>
							<div class="btn-group pull-right post-tools">
								<button class="btn btn-sm btn-default edit {main_posts.display_moderator_edit_tools}" type="button" title="[[topic:edit]]"><i class="fa fa-pencil"></i></button>
							</div>

							<div class="btn-group pull-right post-tools">
								<button class="btn btn-sm btn-default link" type="button" title="[[topic:link]]"><i class="fa fa-link"></i></button>
							</div>

							<input id="post_{main_posts.pid}_link" value="" class="pull-right bookmark-link" style="display:none;" readonly></input>

						</div>

						<div id="content_{main_posts.pid}" class="post-content" itemprop="articleBody">{main_posts.content}</div>
						<div class="post-signature">{main_posts.signature}</div>
						<div class="post-info">
							<span class="pull-right">
								posted <span class="relativeTimeAgo timeago" title="{main_posts.relativeTime}"></span> by <a href="{main_posts.userslugurl}">{main_posts.username}</a>
								<span class="{main_posts.edited-class}">| last edited by <strong><a href="/user/{main_posts.editorslug}">{main_posts.editorname}</a></strong></span>
								<span class="timeago" title="{main_posts.relativeEditTime}"></span>
							</span>
							<div style="clear:both;"></div>
						</div>
					</div>
				</div>
			</li>
		<!-- END main_posts -->

		<!-- BEGIN posts -->
			<a id="post_anchor_{posts.pid}" name="{posts.pid}"></a>
			<li class="post-row sub-posts" data-pid="{posts.pid}" data-uid="{posts.uid}" data-username="{posts.username}" data-deleted="{posts.deleted}" itemscope itemtype="http://schema.org/Comment">
				<meta itemprop="datePublished" content="{posts.relativeTime}">
				<meta itemprop="dateModified" content="{posts.relativeEditTime}">
				<div class="col-md-1 col-sm-1 hidden-xs profile-image-block">
					<a href="{posts.userslugurl}" class="pull-right">
						<img src="{posts.picture}" title="{posts.username}" align="left" class="img-circle" itemprop="image" />
						<span class="label label-danger {posts.show_banned}">[[topic:banned]]</span>
					</a>
				</div>
				<div class="col-md-11 col-sm-11 col-xs-11 pull-right post-block-wrapper">
					<div class="post-block">
						<div class="topic-buttons">
							<div class="btn-group">
								<button class="favourite btn btn-sm btn-default {posts.fav_button_class}" type="button">
									<span class="favourite-text"></span>
									<span class="post_rep_{posts.pid}">{posts.post_rep} </span><i class="{posts.fav_star_class}"></i>
								</button>
								<button class="btn btn-sm btn-primary btn quote" type="button">[[topic:reply]]</button>
							</div>
							<div class="btn-group pull-right post-tools">
								<button class="btn btn-sm btn-default link" type="button" title="[[topic:link]]"><i class="fa fa-link"></i></button>
								<button class="btn btn-sm btn-default edit {posts.display_moderator_edit_tools}" type="button" title="[[topic:edit]]"><i class="fa fa-pencil"></i></button>
								<button class="btn btn-sm btn-default delete {posts.display_moderator_tools}" type="button" title="[[topic:delete]]"><i class="fa fa-trash-o"></i></button>
							</div>

							<input id="post_{posts.pid}_link" value="" class="pull-right bookmark-link" style="display:none;" readonly></input>
						</div>

						<div id="content_{posts.pid}" class="post-content" itemprop="text">{posts.content}</div>
						<div class="post-signature">{posts.signature}</div>
						<div class="post-info">
							<span class="pull-left visible-xs">
								<a href="{posts.userslugurl}">
								<img src="{posts.picture}" width="20px" height="20px" style="width: 20px; height: 20px; margin-bottom: 0px;" title="{posts.username}" align="left" class="img-circle" itemprop="image" />
								<span class="label label-danger {posts.show_banned}">[[topic:banned]]</span>
							</a>
							</span>
							<span class="pull-left">
							{posts.sentimentIcon}&nbsp;{posts.sentimentPolarity}
							</span>
							<span class="pull-right">
								posted <span class="relativeTimeAgo timeago" title="{posts.relativeTime}"></span> by <a href="{posts.userslugurl}">{posts.username}</a>
								<span class="{posts.edited-class}">| last edited by <strong><a href="/user/{posts.editorslug}">{posts.editorname}</a></strong></span>
								<span class="timeago" title="{posts.relativeEditTime}"></span>
							</span>
							<div style="clear:both;"></div>
						</div>
					</div>
				</div>
			</li>
		<!-- END posts -->
	</ul>

	<div id="loading-indicator" style="text-align:center;" class="hide" done="0">
		<i class="fa fa-spinner fa-spin fa-lg"></i>
	</div>

	<hr />

	<div class="topic-main-buttons">
		<button id="post_reply" class="btn btn-primary btn-lg post_reply" type="button">[[topic:reply]]</button>
		<div class="btn-group pull-right" id="thread-tools" style="visibility: hidden;">
			<button class="btn btn-default btn-lg dropdown-toggle" data-toggle="dropdown" type="button"><i class="fa fa-cog"></i> [[topic:thread_tools.title]] <span class="caret"></span></button>
			<ul class="dropdown-menu">
				<li><a href="#" id="pin_thread"><i class="fa fa-thumb-tack"></i> [[topic:thread_tools.pin]]</a></li>
				<li><a href="#" id="lock_thread"><i class="fa fa-lock"></i> [[topic:thread_tools.lock]]</a></li>
				<li class="divider"></li>
				<li><a href="#" id="move_thread"><i class="fa fa-move"></i> [[topic:thread_tools.move]]</a></li>
				<li class="divider"></li>
				<li><a href="#" id="delete_thread"><span class="text-error"><i class="fa fa-trash-o"></i> [[topic:thread_tools.delete]]</span></a></li>
			</ul>
		</div>
	</div>

	<div class="mobile-author-overlay hidden-xs">
		<div class="row">
			<div class="col-xs-3">
				<img id="mobile-author-image" src="" width=50 height=50 />
			</div>
			<div class="col-xs-9">
				<h4><div id="mobile-author-overlay"></div></h4>
			</div>
		</div>
	</div>

	<div id="move_thread_modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="Move Topic" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3>Move Topic</h3>
				</div>
				<div class="modal-body">
					<p id="categories-loading"><i class="fa fa-spin fa-refresh"></i> [[topic:load_categories]]</p>
					<ul class="category-list"></ul>
					<p>
						[[topic:disabled_categories_note]]
					</p>
					<div id="move-confirm" style="display: none;">
						<hr />
						<div class="alert alert-info">This topic will be moved to the category <strong><span id="confirm-category-name"></span></strong></div>
					</div>
				</div>
				<div class="modal-footer">
					<button type="button" class="btn btn-default" data-dismiss="modal" id="move_thread_cancel">[[global:buttons.close]]</button>
					<button type="button" class="btn btn-primary" id="move_thread_commit" disabled>[[topic:confirm_move]]</button>
				</div>
			</div>
		</div>
	</div>

</div>
<script>
if (window.Mousetrap) {
	Mousetrap.bind('r', function() { $('#post_reply').click(); return false; });
}
</script>
