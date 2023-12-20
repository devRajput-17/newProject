require('dotenv').config();
const restify = require('restify');
const corsMiddleware = require('restify-cors-middleware');
let sql = require("mssql");
const Util = require('./util.js');
var CronJob = require('cron').CronJob;
var request = require('request');

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
    origins: ['*']
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.acceptParser(server.acceptable));
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());

sql.connect(config, async function (err) {
    if (err) console.log(err);
    var request = new sql.Request();
    console.log('db connected');
    app.db = request;
    global.sqlConnection = request;
    await Util.createSentItemsRoutingImapConnection();
    await Util.updateAction( app , 'sentItems' , false )
    init(app);
});

function init(application) {
    route(application);
    var sentItemsRouting = new CronJob('0 */'+process.env.SENT_ITEM_ROUTING +' * * * * ' , function() {
        request('http://localhost:3044/stuck/emails/sentItems');
    }, null, true);
    sentItemsRouting.start();
    application.server.listen(3044, function () {
        console.log('%s listening at %s', server.name, server.url);
    });
}

function route(application) {
    require('./handlers/sentItems')(application);
}