;(function () {
  'use strict'

  // Configuration setup
  var nconf = require('nconf')
  nconf.argv().env()

  var fs = require('fs'),
    async = require('async'),
    winston = require('winston'),
    pkg = require('./package.json'),
    path = require('path'),
    meta
  var install = require('./src/install')

  // Runtime environment
  global.env = process.env.NODE_ENV || 'production'

  winston.remove(winston.transports.Console)
  winston.add(winston.transports.Console, {
    colorize: true
  })

  winston.add(winston.transports.File, {
    filename: 'error.log',
    level: 'error'
  })

  // TODO: remove once https://github.com/flatiron/winston/issues/280 is fixed
  winston.err = function (err) {
    winston.error(err.stack)
  }

  // CoLearnr: Replace all config.json with configFile variable
  var configFile = path.resolve(__dirname, 'config-' + (process.env.ENV_CONFIG || 'dev') + '.json')
  if (fs.existsSync('/cl/conf/config-discuss.json')) {
    configFile = '/cl/conf/config-discuss.json'
  }

  // Find the ip address of this installation
  var dev_ip_map = {}
  var INSTALL_HOST = null
  var os = require('os')
  var ifaces = os.networkInterfaces()
  for (var dev in ifaces) {
    var alias = 0
    ifaces[dev].forEach(function (details) {
      if (!details.internal && details.family === 'IPv4') {
        dev_ip_map[dev + (alias ? ':' + alias : '')] = details.address
        if (!INSTALL_HOST) {
          INSTALL_HOST = details.address
        }
        ++alias
      }
    })
  }

  if (!INSTALL_HOST) {
    INSTALL_HOST = '127.0.0.1'
  }

  if (!nconf.get('help') && !nconf.get('setup') && !nconf.get('upgrade') && !nconf.get('category') && fs.existsSync(configFile)) {
    // Load server-side configs
    nconf.file({
      file: configFile
    }).defaults({
      'base_url': 'http://' + INSTALL_HOST,
      'api_url': 'http://' + INSTALL_HOST + '/api/',
      'app_login': 'http://' + INSTALL_HOST + ':8080/login',
      'app_home': 'http://' + INSTALL_HOST + ':8080',
      'socket_server': 'http://' + INSTALL_HOST + ':4567'
    })
    nconf.set('url', (nconf.get('base_url') + (nconf.get('use_port') ? ':' + nconf.get('port') : '') + nconf.get('relative_path') + '/'))
    nconf.set('upload_url', nconf.get('url') + 'uploads/')

    meta = require('./src/meta.js')

    install.category(function (err) {
      if (err) {
        winston.error('There was a problem completing category creation: ', err.message)
      } else {
        winston.info('discuss Setup Completed.')
      }

      winston.info('Initializing discuss v' + pkg.version + ', on port ' + nconf.get('port') + ', using Redis store at ' + nconf.get('redis:host') + ':' + nconf.get('redis:port') + '.')
      winston.info('discuss instance bound to: ' + nconf.get('url'))

      if (process.env.NODE_ENV === 'development') {
        winston.info('Base Configuration OK.')
      }

      meta.configs.init(function () {
        var templates = require('./public/src/templates.js'),
          translator = require('./public/src/translator.js'),
          webserver = require('./src/webserver.js'),
          SocketIO = require('socket.io').listen(global.server, {
            log: false,
            transports: ['websocket', 'xhr-polling', 'jsonp-polling', 'flashsocket']
          }),
          websockets = require('./src/websockets.js'),
          posts = require('./src/posts.js'),
          plugins = require('./src/plugins'), // Don't remove this - plugins initializes itself
          Notifications = require('./src/notifications')

        websockets.init(SocketIO)

        global.templates = {}
        global.translator = translator

        translator.loadServer()

        var customTemplates = meta.config['theme:templates'] ? path.join(__dirname, 'node_modules', meta.config['theme:id'], meta.config['theme:templates']) : false

        // todo: replace below with read directory code, derp.
        templates.init([
          'header', 'header-simple', 'branding/header-ielol', 'footer', 'footer-simple', 'logout', 'outgoing', 'admin/header', 'admin/footer', 'admin/index',
          'emails/reset', 'emails/reset_plaintext', 'emails/email_confirm', 'emails/email_confirm_plaintext',
          'emails/header', 'emails/footer',

          'noscript/header', 'noscript/home', 'noscript/category', 'noscript/topic'
        ], customTemplates)

        templates.ready(webserver.init)

        Notifications.init()
      })
    })
  } else if (nconf.get('setup') || !fs.existsSync(configFile)) {
    // New install, ask setup questions
    if (nconf.get('setup')) {
      winston.info('discuss Setup Triggered via Command Line')
    } else {
      winston.warn('Configuration not found, starting discuss setup')
    }

    nconf.file({
      file: configFile
    })

    var install = require('./src/install')

    winston.info('Welcome to discuss!')
    winston.info("This looks like a new installation, so you'll have to answer a few questions about your environment before we can proceed.")
    winston.info('Press enter to accept the default setting (shown in brackets).')

    install.setup(function (err) {
      if (err) {
        winston.error('There was a problem completing discuss setup: ', err.message)
      } else {
        winston.info("discuss Setup Completed. Run 'node app' to manually start your discuss server.")
      }

      process.exit()
    })
  } else if (nconf.get('category')) {
    if (nconf.get('category')) {
      winston.info('discuss Setup Triggered via Command Line')
    } else {
      winston.warn('Configuration not found, starting discuss setup')
    }

    var install = require('./src/install')

    install.category(function (err) {
      if (err) {
        winston.error('There was a problem completing category creation: ', err.message)
      } else {
        winston.info("discuss Setup Completed. Run 'node app' to manually start your discuss server.")
      }

      process.exit()
    })
  } else if (nconf.get('upgrade')) {
    nconf.file({
      file: configFile
    })
    meta = require('./src/meta.js')

    meta.configs.init(function () {
      require('./src/upgrade').upgrade()
    })
  } else /* if (nconf.get('help') */ {
    winston.info('Usage: node app [options] [arguments]')
    winston.info('       [NODE_ENV=development | NODE_ENV=production] node app [--start] [arguments]')
    winston.info('')
    winston.info('Options:')
    winston.info('  --help              displays this usage information')
    winston.info('  --setup             configure your environment and setup discuss')
    winston.info('  --upgrade           upgrade discuss, first read: github.com/designcreateplay/discuss/wiki/Upgrading-discuss')
    winston.info('  --start             manually start discuss (default when no options are given)')
  }
}())
