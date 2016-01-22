
	</div><!--END container -->

	<div id="chat-modal" class="modal chat-modal" tabindex="-1" role="dialog" aria-labelledby="Chat" aria-hidden="true" data-backdrop="none">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3 id="myModalLabel">[[footer:chat.chatting_with]]</h3>
				</div>
				<div class="modal-body">
					<div id="chat-content"></div><br/>
					<input id="chat-message-input" type="text" class="form-control" name="chat-message" placeholder="[[footer:chat.placeholder]]"/>
				</div>
				<div class="modal-footer">
					<button type="button" id="chat-message-send-btn" href="#" class="btn btn-primary btn-lg btn-block
					">[[footer:chat.send]]</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

	<div id="upload-picture-modal" class="modal fade" tabindex="-1" role="dialog" aria-labelledby="Upload Picture" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
					<h3 id="myModalLabel">Upload Picture</h3>
				</div>
				<div class="modal-body">
					<form id="uploadForm" action="" method="post" enctype="multipart/form-data">
						<div class="form-group">
							<label for="userPhoto">Upload a picture</label>
							<input type="file" id="userPhotoInput"  name="userPhoto">
							<p class="help-block">You may only upload PNG, JPG, or GIF files under 256kb.</p>
						</div>
						<input id="imageUploadCsrf" type="hidden" name="_csrf" value="" />
					</form>

					<div id="upload-progress-box" class="progress progress-striped">
						<div id="upload-progress-bar" class="progress-bar progress-bar-success" role="progressbar" aria-valuenow="0" aria-valuemin="0">
							<span class="sr-only"> success</span>
						</div>
					</div>

					<div id="alert-status" class="alert alert-info hide"></div>
					<div id="alert-success" class="alert alert-success hide"></div>
					<div id="alert-error" class="alert alert-danger hide"></div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-default" data-dismiss="modal" aria-hidden="true">Close</button>
					<button id="pictureUploadSubmitBtn" class="btn btn-primary">Upload Picture</button>
				</div>
			</div><!-- /.modal-content -->
		</div><!-- /.modal-dialog -->
	</div><!-- /.modal -->

	<div id="alert_window"></div>

		<footer id="footer" class="container footer">

        </footer>

	<script>
		require(['forum/footer']);
	</script>

    <script>

    var $menu = $(".dropdown-menu");
    var mediaQuery = 'desk';
    if (Modernizr.mq('only screen and (max-width: 600px)')) {
        mediaQuery = 'mobile';
    }

    // jQuery-menu-aim: <meaningful part of the example>
    // Hook up events to be fired on menu row activation.
    if (mediaQuery == 'desk') {
        $menu.menuAim({
            activate: activateSubmenu,
            deactivate: deactivateSubmenu
        });
    }

    // jQuery-menu-aim: </meaningful part of the example>

    // jQuery-menu-aim: the following JS is used to show and hide the submenu
    // contents. Again, this can be done in any number of ways. jQuery-menu-aim
    // doesn't care how you do this, it just fires the activate and deactivate
    // events at the right times so you know when to show and hide your submenus.
    function activateSubmenu(row) {
        var $row = $(row),
                submenuId = $row.data("submenuId"),
                $submenu = $("#" + submenuId),
                height = $menu.outerHeight(),
                width = $menu.outerWidth();
        // Show the submenu
        $submenu.css({
            display: "block",
            top: -1,
            left: width - 3,  // main should overlay submenu
            height: height - 4  // padding for main dropdown's arrow
        });

        // Keep the currently activated row's highlighted look
        $row.find("a").addClass("maintainHover");
    }

    function deactivateSubmenu(row) {
        var $row = $(row),
                submenuId = $row.data("submenuId"),
                $submenu = $("#" + submenuId);

        // Hide the submenu and remove the row's highlighted look
        $submenu.css("display", "none");
        $row.find("a").removeClass("maintainHover");
    }

    // Bootstrap's dropdown menus immediately close on document click.
    // Don't let this event close the menu if a submenu is being clicked.
    // This event propagation control doesn't belong in the menu-aim plugin
    // itself because the plugin is agnostic to bootstrap.
    if (mediaQuery == 'desk') {
        $(".dropdown-menu li").click(function(e) {
            e.stopPropagation();
        });

        $(document).click(function() {
            // Simply hide the submenu on any click. Again, this is just a hacked
            // together menu/submenu structure to show the use of jQuery-menu-aim.
            $(".popover").css("display", "none");
            $("a.maintainHover").removeClass("maintainHover");
        });
    }
    $('.dropdown a').click(function(e) {
      //e.preventDefault();
      setTimeout($.proxy(function() {
        if ('ontouchstart' in document.documentElement) {
          $(this).siblings('.dropdown-backdrop').off().remove();
        }
      }, this), 0);
    });
	</script>
</body>
</html>
