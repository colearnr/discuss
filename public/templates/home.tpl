<div class="row home" itemscope itemtype="http://www.schema.org/ItemList">
	<!-- BEGIN categories -->
	<div class="col-md-3 col-xs-6">
		<div class="well item-card">
			<a href="category/{categories.slug}" itemprop="url">
				<meta itemprop="name" content="{categories.name}">
				<h4><span class="badge {categories.badgeclass} pull-right">{categories.topic_count} </span></h4>
				<div id="category-{categories.cid}" class="category-slider-{categories.post_count}">
					<h3>{categories.name}</h3>
					<br/>
				</div>
			</a>
		</div>
	</div>
	<!-- END categories -->
</div>

<div class="row footer-stats">
	<div class="col-md-3 col-xs-6">
		<div class="stats-card well">
			<h2><span id="stats_online"></span><br /><small>[[footer:stats.online]]</small></h2>
		</div>
	</div>
	<div class="col-md-3 col-xs-6">
		<div class="stats-card well">
			<h2><span id="stats_users"></span><br /><small>[[footer:stats.users]]</small></h2>
		</div>
	</div>
	<div class="col-md-3 col-xs-6">
		<div class="stats-card well">
			<h2><span id="stats_topics"></span><br /><small>[[footer:stats.topics]]</small></h2>
		</div>
	</div>
	<div class="col-md-3 col-xs-6">
		<div class="stats-card well">
			<h2><span id="stats_posts"></span><br /><small>[[footer:stats.posts]]</small></h2>
		</div>
	</div>
</div>
