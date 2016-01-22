<h1>Plugins</h1>

<ul class="plugins">
	<!-- BEGIN plugins -->
	<li data-plugin-id="{plugins.id}">
		<h2>{plugins.name}</h2>
		<div class="pull-right">
			<button data-action="toggleActive" class="btn btn-primary">{plugins.activeText}</button>
		</div>
		<p>{plugins.description}</p>
		<p>For more information: <a href="{plugins.url}">{plugins.url}</a></p>
	</li>
	<!-- END plugins -->
</ul>

<div class="alert alert-warning">
	<p>
		<strong>Interested in writing plugins for discuss?</strong>
	</p>
	<p>
		Full documentation regarding plugin authoring can be found in the <a target="_blank" href="https://github.com/designcreateplay/discuss/wiki/Writing-Plugins-for-discuss">discuss Wiki</a>.
	</p>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/admin/plugins.js"></script>
