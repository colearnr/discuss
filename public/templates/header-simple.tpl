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
    <script src="{cdn_prefix}/vendor/jquery/js/modernizr.min.js" type="text/javascript"></script>
    <script src="{cdn_prefix}/vendor/jquery/js/jquery.expander.min.js" type="text/javascript"></script>
    <script>
        $(window).bind('hashchange', function(event) {
            if (window.location.hash && (window.location.hash.indexOf('t=') != -1) || (window.location.hash.indexOf('p=') != -1) ) {
                var vindex = window.location.hash.indexOf('t=');
                if (vindex != -1) {
                    var videoSec = window.location.hash.substring(vindex + 2);
                    if (videoSec && $.postMessage && window.parent) {
                        $.postMessage('#t=' + videoSec, '*', parent);
                        location.hash = "";
                    }
                }
                var pindex = window.location.hash.indexOf('p=');
                if (pindex != -1) {
                    var page = window.location.hash.substring(pindex + 2);
                    if (page && $.postMessage && window.parent) {
                        $.postMessage('#p=' + page, '*', parent);
                        location.hash = "";
                    }
                }
            }
        });
    </script>
    {editor}
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/theme.css" />
	<link rel="stylesheet" type="text/css" href="{relative_path}/css/mainweb.css" />
    <link rel="stylesheet" type="text/css" href="{relative_path}/css/overrides.css" />
	<style type="text/css">
        div.topic {
            margin-left: 0px;
            margin-right: 0px;
        }
        #content {
            padding-bottom: 0px;
        }
        .post-block {
			background-color: #FFFFFF;
        }
    </style>
</head>

<body style="background: #FFFFFF; margin: 0px; padding: 10px 0px 10px 0px;">

	<input id="csrf_token" type="hidden" template-variable="csrf" value="{csrf}" />

	<div class="" id="content">
