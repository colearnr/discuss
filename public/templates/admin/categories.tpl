
<h1>Categories</h1>

<hr />
<ul class="nav nav-pills">
	<li class='active'><a href='/admin/categories/active'>Active</a></li>
	<li class=''><a href='/admin/categories/disabled'>Disabled</a></li>
	<li class=''><a href='/admin/testing/categories'>Unit Tests</a></li>
</ul>

<!-- TODO: remove inline event listeners. -->

<div class="row admin-categories">
	<ul class="col-md-12" id="entry-container">
	<!-- BEGIN categories -->
		<li data-cid="{categories.cid}" class="entry-row {categories.blockclass}">
			<form class="form-inline">
				<div class="icon">
					<i data-name="icon" value="{categories.icon}" class="{categories.icon} fa-2x"></i>
				</div>
				<input placeholder="Category Name" data-name="name" value="{categories.name}" class="form-control category_name"></input>
				<select class="form-control blockclass" data-name="blockclass" data-value="{categories.blockclass}">
					<option value="category-purple">category-purple</option>
					<option value="category-darkblue">category-darkblue</option>
					<option value="category-blue">category-blue</option>
					<option value="category-darkgreen">category-darkgreen</option>
					<option value="category-orange">category-orange</option>
				</select>
				<input data-name="description" placeholder="Category Description" value="{categories.description}" class="form-control category_description description"></input>
				<input type="hidden" data-name="order" data-value="{categories.order}"></input>
				<button type="submit" class="btn btn-default disable-btn" data-disabled="{categories.disabled}">Disable</button>
			</form>
		</li>

	<!-- END categories -->
	</ul>

	<button class="btn btn-lg btn-primary" id="save">Save</button>
	<button class="btn btn-lg btn-primary" id="addNew">Add New</button>
</div>

<div id="new-category-modal" class="modal" tabindex="-1" role="dialog" aria-labelledby="Add New Modal" aria-hidden="true">
	<div class="modal-dialog">
		<div class="modal-content">
			<div class="modal-header">
				<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
				<h3>Create New Category</h3>
			</div>
			<div class="modal-body">
				<div>
				<form class='form-horizontal'>
					<div class="control-group">
						<label class="control-label" for="inputName">Name</label>
						<div class="controls">
							<input class="form-control" type="text" id="inputName" placeholder="Name" value="">
						</div>
					</div>

					<div class="control-group">
						<label class="control-label" for="inputDescription">Description</label>
						<div class="controls">
							<input class="form-control" type="text" id="inputDescription" placeholder="Description" value="">
						</div>
					</div>

					<div class="control-group">
						<label class="control-label" for="inputIcon">Icon</label>
						<div class="controls">
							<div class="icon">
								<i data-name="icon" value="fa-pencil" class="fa fa-pencil fa-2x"></i>
							</div>
						</div>
					</div>

					<div class="control-group">
						<label class="control-label" for="inputBlockclass">Block Class</label>
						<div class="controls">
							<select id="inputBlockclass" class="form-control" data-name="blockclass" data-value="">
								<option value="category-purple">category-purple</option>
								<option value="category-darkblue">category-darkblue</option>
								<option value="category-blue">category-blue</option>
								<option value="category-darkgreen">category-darkgreen</option>
								<option value="category-orange">category-orange</option>
							</select>
						</div>
					</div>

				</form>
			</div>
			</div>
			<div class="modal-footer">
				<button type="button" id="create-category-btn" href="#" class="btn btn-primary btn-lg btn-block">Create</button>
			</div>
		</div><!-- /.modal-content -->
	</div><!-- /.modal-dialog -->
</div><!-- /.modal -->

