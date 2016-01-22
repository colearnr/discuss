<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">{category_name}</span> &nbsp;<a href="{topic_url}" title="Back to the topic"> <i class="fa fa-external-link"></i></a>
	</li>
	<div id="category_active_users"></div>
</ol>

<div>
	<button id="new_post" class="btn btn-primary btn-lg {show_topic_button}">[[category:new_topic_button]]</button>
</div>

<hr/>

<div class="alert alert-warning hide {no_topics_message}" id="category-no-topics">
	[[category:no_topics]]
</div>

<div class="category row">
	<div class="{topic_row_size}">
		<ul id="topics-container" itemscope itemtype="http://www.schema.org/ItemList">
			<meta itemprop="itemListOrder" content="descending">
			<!-- BEGIN topics -->
			<li class="category-item {topics.deleted-class}" itemprop="itemListElement">
				<div class="row">
					<div class="col-md-12 topic-row">
						<div>
							<a href="../../topic/{topics.slug}" itemprop="url">
								<h3>
									<meta itemprop="name" content="{topics.title}">

									<span class="topic-title">
										<strong><i class="{topics.pin-icon}"></i> <i class="{topics.lock-icon}"></i></strong>
										{topics.title}
									</span>
								</h3>
							</a>
							<small>
								<span class="topic-stats">
									posts
									<strong>{topics.postcount}</strong>
								</span>
								|
								<span class="topic-stats">
									views
									<strong>{topics.viewcount}</strong>
								</span>
								|
								<span>
									<a href="/user/{topics.userslug}">
										<img class="teaser-pic img-circle" src="{topics.picture}" title="{topics.username}"/>
									</a>
									posted <span class="timeago" title="{topics.relativeTime}"></span>
								</span>

								<span class="pull-right hidden-xs">
									<a href="/user/{topics.teaser_userslug}">
										<img class="teaser-pic img-circle" src="{topics.teaser_userpicture}" title="{topics.teaser_username}"/>
									</a>
									<a href="../../topic/{topics.slug}#{topics.teaser_pid}">
										replied
									</a>
									<span class="timeago" title="{topics.teaser_timestamp}"></span>

								</span>
							</small>
						</div>
					</div>
				</div>
			</li>
			<!-- END topics -->
		</ul>
	</div>
	<div class="col-md-3 {show_sidebar} category-sidebar">

		<div class="sidebar-block img-thumbnail">
			<div class="block-header">
				[[category:sidebar.recent_replies]]
			</div>
			<div class="block-content recent-replies">
				<ul id="category_recent_replies"></ul>
			</div>
		</div>
		<div class="sidebar-block img-thumbnail">
			<div class="block-header">
				[[category:sidebar.active_participants]]
			</div>
			<div class="block-content active-users">
				<!-- BEGIN active_users -->
				<a data-uid="{active_users.uid}" href="/user/{active_users.userslug}"><img title="{active_users.username}" src="{active_users.picture}" class="img-circle" /></a>
				<!-- END active_users -->
			</div>
		</div>
		<div class="sidebar-block img-thumbnail {moderator_block_class}">
			<div class="block-header">
				[[category:sidebar.moderators]]
			</div>
			<div class="block-content">
				<!-- BEGIN moderators -->
				<a href="/user/{moderators.userslug}"><img title="{moderators.username}" src="{moderators.picture}" class="img-circle" /></a>
				<!-- END moderators -->
			</div>
		</div>
		<!-- BEGIN sidebars -->
		<div class="sidebar-block img-thumbnail {sidebars.block_class}">
			<div class="block-header">
				{sidebars.header}
			</div>
			<div class="block-content">
				{sidebars.content}
			</div>
		</div>
		<!-- END sidebars -->
	</div>
</div>

<input type="hidden" template-variable="category_id" value="{category_id}" />
<input type="hidden" template-variable="short_url" value="{short_url}" />
<script>
if (window.Mousetrap) {
	Mousetrap.bind('t', function() { $('#new_post').click(); return false; });
}
</script>
