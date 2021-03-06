<h1>Topics</h1>
<hr />

<ul class="topics">
	<!-- BEGIN topics -->
	<li data-tid="{topics.tid}" data-locked="{topics.locked}" data-pinned="{topics.pinned}" data-deleted="{topics.deleted}">
		<div class="btn-group pull-right">
			<button data-action="pin" class="btn"><i class="fa fa-thumb-tack"></i></button>
			<button data-action="lock" class="btn"><i class="fa fa-lock"></i></button>
			<button data-action="delete" class="btn"><i class="fa fa-trash-o"></i></button>
		</div>
		<a target="_blank" href="{relative_path}/topic/{topics.slug}">{topics.title}</a>
		<ul>
			<li><i class="fa fa-clock-o"></i> Posted <span class="timeago" title="{topics.relativeTime}"></span> by {topics.username}</li>
			<li><i class="fa fa-comments"></i> {topics.postcount} post(s)</li>
		</ul>
		<div class="clear"></div>
	</li>
	<!-- END topics -->
</ul>

<div class="text-center">
	<button id="topics_loadmore" class="btn btn-primary btn-lg">Load More Topics</button>
</div>
