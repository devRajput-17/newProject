require('dotenv').config();
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
let sql = require("mssql");
const cronFunction = require('./cron.js');
const Util = require('./util.js');

const server = restify.createServer({
    name: 'email-stuck-api',
    version: '1.0.0'
});

var config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    server: 'localhost', 
    database: process.env.DB_NAME,
    port: 1433,
    "pool": {
        "max": 10,
        "min": 0,
        "idleTimeoutMillis": 30000
    },
    "options": {
        "encrypt": true,
        "enableArithAbort": true
    }
};

var app = {
    server
};

const cors = corsMiddleware({
    preflightMaxAge: 5,
    origins: ['*'],
     allowHeaders: ['Authorization', 'x-email-management-auth']
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(function (req, res, next) {
    res.setHeader(
      'Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; frame-src 'self'"
    );
    next();
});
sql.connect(config, async function (err) {
    if (err) console.log(err);
    var request = new sql.Request();
    console.log('db connected');
    app.db = request;
    global.sqlConnection = request;
    await Util.createSkillGroupRoutingImapConnection();
    await Util.createAgentFolderRoutingImapConnection();
    await Util.createSentItemsRoutingImapConnection();
    // await Util.updateAction( app , 'skillGroup' , false )
    // await Util.updateAction( app , 'agentFolder' , false )
    // await Util.updateAction( app , 'sentItems' , false )
    init(app);
});

function init(application) {
    route(application);
    cronFunction();
    application.server.listen(3043, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
}

function route(application) {
    require('./handlers/skillGroup')(application);
    require('./handlers/agentFolder')(application);
    require('./handlers/sentItems')(application);
    require('./handlers/moveToComplete')(application);
}