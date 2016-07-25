<!DOCTYPE html>
<html>
<head>
	<title>{browserTitle}</title>
	{meta_tags}
	<meta name="title" CONTENT="discuss | CoLearnr">
	<link href="{cssSrc}" rel="stylesheet" media="screen">
	<link rel="stylesheet" href="{relative_path}/vendor/fontawesome/css/font-awesome.min.css">
	{link_tags}
	<link href="{relative_path}/vendor/fonts/source-sans-pro/source-sans-pro.css" rel="stylesheet" type="text/css">
	<!-- BEGIN pluginCSS -->
	<link rel="stylesheet" href="{pluginCSS.path}">
	<!-- END pluginCSS -->
	<script>
		var RELATIVE_PATH = "{relative_path}";
		var SOCKET_SERVER = "{socket_server}";
		var APP_HOME = "{app_home}";
		var APP_HOME_HTTP = "{app_home_http}";
		var APP_HOME_HTTPS = "{app_home_https}";
                if ("{documentDomain}" !== "") {
		    document.domain = "{documentDomain}";
                }
	</script>
	<script src="{relative_path}/socket.io/socket.io.js"></script>
	<script src="{cdn_prefix}/vendor/mousetrap/mousetrap-1.4.6.min.js"></script>
    <script>
    Mousetrap.bind('d', function() { window.location = $('#discuss-menu ul.dropdown-menu li a:first').attr('href'); return false; });
	Mousetrap.bind('m', function() { window.location = "{app_home}/user/topic"; return false; });
	Mousetrap.bind('n', function() { window.location = "{app_home}/topic/new"; return false; });
	</script>
	<!-- BEGIN clientScripts -->
	<script src="{relative_path}/{clientScripts.script}"></script>
	<!-- END clientScripts -->
	<script>
		require.config({
			baseUrl: "{relative_path}/src/modules",
			paths: {
				"forum": '../forum'
			}
		});
	</script>
    <script src="{cdn_prefix}/vendor/jquery/js/jquery.menu-aim.js" type="text/javascript"></script>
    <script src="{cdn_prefix}/vendor/bootstrap/js/hover.min.js" type="text/javascript"></script>
    <script src="{cdn_prefix}/vendor/jquery/js/modernizr.min.js" type="text/javascript"></script>
    <script src="{cdn_prefix}/vendor/jquery/js/jquery.expander.min.js" type="text/javascript"></script>
    {editor}
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/theme.css" />
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/mainweb.css" />
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/overrides.css" />
</head>

<body>
	<div class="navbar navbar-inverse navbar-fixed-top header" role="navigation" id="header-menu">
		<header>
			<div class="container">
				<div class="navbar-header">
		            <a class="navbar-brand" href="{app_home}"></a>
		            <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
		                <span class="glyphicon glyphicon-bar"></span>
		                <span class="glyphicon glyphicon-bar"></span>
		                <span class="glyphicon glyphicon-bar"></span>
		            </button>
	            </div>
				<div class="navbar-collapse collapse navbar-ex1-collapse">
					<ul id="learn-nav" class="nav navbar-nav">
	                    <li class="dropdown">
	                        <a href="#" class="dropdown-toggle" data-hover="dropdown" data-toggle="dropdown"><i class="fa fa-book"></i> Topics <b class="caret"></b></a>
	                        <ul class="dropdown-menu" role="menu">
	                            {learn_menu}
	                            <li class="divider hidden-xs"></li>
	                            <li class="hidden-xs"><a href="{app_home}/topic/new"><i class="fa fa-file"></i>&nbsp; New Topic <kbd class="pull-right">n</kbd></a></li>
	                        </ul>
	                    </li>
	                </ul>
	                <ul id="discuss-menu" class="nav navbar-nav">
                        <li class="dropdown">
                            <a href="#" class="dropdown-toggle" data-hover="dropdown" data-toggle="dropdown"><i class="fa fa-comments"></i> Discussions <b class="caret"></b></a>
                            <ul class="dropdown-menu" role="menu">
                            	<li data-submenu-id="submenu-home">
                                    <a href="/">Home <kbd class="pull-right">d</kbd></a>
                                </li>
                                <li data-submenu-id="submenu-recent">
                                    <a href="/recent"><i class="fa fa-comment"></i> [[global:header.recent]]</a>
                                </li>
                                <li class="discuss-loggedin" data-submenu-id="submenu-new">
                                    <a href="/unread"><i class="fa fa-comment-o"></i> New discussions</a>
                                </li>
                            </ul>
                        </li>
                    </ul>
					<ul id="main-nav" class="nav navbar-nav">
						<li class="{adminDisplay}">

							<a href="/admin"><i class="fa fa-cogs"></i> [[global:header.admin]]</a>
						</li>
						<li class="visible-xs">
							<a href="/search">[[global:header.search]]</a>
						</li>
						<!-- BEGIN navigation -->
						<li class="{navigation.class}">
							<a href="{navigation.route}">{navigation.text}</a>
						</li>
						<!-- END navigation -->
					</ul>


					<ul id="logged-in-menu" class="nav navbar-nav navbar-right hide">
						<li>
							<a href="#" id="reconnect"></a>
						</li>

						<li id="notifications-list" class="notifications dropdown text-center hidden-xs">
							<a class="dropdown-toggle" data-toggle="dropdown" href="#" id="notif_dropdown"><i class="fa fa-circle-o"></i></a>
							<ul id="notif-list" class="dropdown-menu" aria-labelledby="notif_dropdown">
								<li>
									<a href="#"><i class="fa fa-refresh fa-spin"></i> [[global:notifications.loading]]</a>
								</li>
							</ul>
						</li>

						<li id="user_label" class="dropdown">
							<a class="dropdown-toggle" data-hover="dropdown" data-toggle="dropdown" href="#" id="user_dropdown">
								<img src="{cdn_prefix}/images/profile/profile_1.jpg" class="img-circle"/> <span class="hidden-sm">&nbsp; </span> <b class="caret"></b>
							</a>
							<ul id="user-control-list" class="dropdown-menu" aria-labelledby="user_dropdown">
								<li><a href="http://www.colearnr.com/help"><i class="fa fa-question-circle"></i> Help</a></li>
								<li><a href="{app_home}/user/topic"><i class="fa fa-book"></i> My Topics <kbd class="pull-right">m</kbd></a></li>
                            	<li><a href="{app_home}/profile/edit"><i class="fa fa-user"></i> Profile</a></li>

								<li id="logout-link">
									<a href="{app_home}/logout"><i class="fa fa-sign-out"></i> Log out</a>
								</li>
							</ul>
						</li>

					</ul>

					<ul id="logged-out-menu" class="nav navbar-nav navbar-right">
						<li>
							<a class="dropdown-toggle" data-hover="dropdown" data-toggle="dropdown" href="#" id="loggedout_dropdown"><img class="navProfileImage img-circle" src="{cdn_prefix}/images/profile/profile_1.jpg" width="25px" height="25px" />&nbsp; guest <b class="caret"></b></i></a>
							<ul class="dropdown-menu" aria-labelledby="loggedout_dropdown">
								<li>
									<a href="{app_home}/help"><i class="fa fa-question-circle"></i> Help</a>
								</li>
								<li>
									<a href="{app_home}/register">Register</a>
								</li>
								<li>
									<a href="{app_home}/login"><i class="fa fa-sign-in"></i> Login</a>
								</li>
							</ul>
						</li>
					</ul>

					<div class="pagination-block">
						<i class="fa fa-cloud-upload pointer"></i>
						<span id="pagination"></span>
						<i class="fa fa-cloud-upload pointer fa-rotate-180"></i>
					</div>
				</div>
			</div>
		</header>
	</div>

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="container" id="content">
