const async = require('async');
const moment = require('moment');
const _ = require('underscore');
var Util = require('../util');
var imap = require('../handlers/imap');
var tickets = require('./tickets');
var getAgent = require('./getAgent');


function skillGroupEmails(app) {

    app.server.get('/stuck/emails/skillGroup', async function (req, res) {
        Util.writeLogs("Status of Skill Group Imap Connection : " + skillGroupEmailImapConnection.state)
         
        if(skillGroupEmailImapConnection.state != 'authenticated'){
            await Util.createSkillGroupRoutingImapConnection();
            // await Util.updateAction( app , 'skillGroup' , false )
            return res.send(201)
        }
        // var isAction = await Util.checkAction( app , 'skillGroup')
        // if(isAction) return res.send(201);


        Util.writeLogs("Start Skill Group Routing")
        Util.writeLogs("Start groups emails")
        skillGroupEmailRouting(app, skillGroupEmailImapConnection, () => {
            Util.writeLogs("End groups emails")
            Util.writeLogs("Start move groups emails to agent folder")
            emailMovetoAgentFolder( app, skillGroupEmailImapConnection, () => {
                Util.writeLogs("End move groups emails to agent folder");
                Util.writeLogs("End Skill Group Routing")
                res.send(200)
            })
        });
        
    });
   
}


function skillGroupEmailRouting ( app , imapConnection, CBK ){

    async.waterfall([

        // Get Groups
        function(cbk){
            getGroups(app, (groups)=> {
                console.log( groups)
                console.log("1111")
                cbk( null, groups)
            })
        },

        //Iterate Groups
        function(groups, cbk){
            console.log("2222")
            if(groups && groups.length){
                iterateGroups(app, groups,imapConnection, (emails)=> {
                    cbk( null, emails)
                })
            }else{
                cbk()
            }
        },

    ], () => {
        console.log("3333")
        CBK()
    })
}

function getGroups(app,cbk){
    app.db.query('SELECT * FROM groups WHERE isActive=1  ', (err, groups) => {
        if (groups && groups.recordset && groups.recordset.length) {
            var groupsArray =  groups.recordset;
            cbk(groupsArray)
        }else{
            cbk([])
        }
    })
}

function iterateGroups(app,groups,imapConnection, groupCbk){

    async.forEachSeries(groups,  function (group, CBK  ) {

        Util.writeLogs('&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&')
        Util.writeLogs(`Group  : ${group.name}`)

        async.waterfall([

            // get emails from imap
            function(cbk){
                if(group && group.id){
                    imap.getEmails( imapConnection , group.name, function (emails) {
                        Util.writeLogs(`Emails Count  : ${emails.length}`)
                        Util.writeLogs('&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&')
                        cbk(null, emails)
                    })
                }else{
                    cbk(null,null)
                }
            },

            // Iterate Emails
            function(emails, cbk){
                if(emails && emails.length){
                    iterateEmails( app,  emails, group, function (emails) {
                        cbk(null,null)
                    })
                }else{
                    cbk(null,null)
                }
            }

        ], function(){
            CBK()
        })
    },function(){
        groupCbk()
    })
}


function iterateEmails(app, emails, group,  emailCbk){

    async.forEachSeries(emails,  function (email, CBK  ) {

        if(email && email.subject){
            let r = email;
            r.groupId = group.id;
            r.subjectOri = r.subject.replace(/'/g, '"').trim();
            r.subject = r.subject.includes('[EXTERNAL]') ? r.subject.replace('[EXTERNAL]','') : r.subject.includes('[External]') ? r.subject.replace('[External]','') : r.subject.includes('[external]') ? r.subject.replace('[external]','') : r.subject ;
            r.subject = r.subject.replace(/'/g, '"');
            r.subject = r.subject.trim();
            r.mailFrom = Util.modifyMailFrom(r.mailFrom)
            r.mailFrom = r.mailFrom.toLowerCase();

            async.waterfall([

                // get emails from db
                function(cbk){
                    app.db.query(
                        `SELECT * FROM emails WHERE subject='${email.subject}' AND mailFrom LIKE '%${email.mailFrom}%' AND receivedTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'`,
                        (err, result) => {
                                   console.log(`SELECT * FROM emails WHERE subject='${email.subject}' AND mailFrom LIKE '%${email.mailFrom}%' AND receivedTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'`)
                            if(err){
                                cbk(null,null)
                            }else {
                                cbk(null, result);
                            }
                        }   
                    )
                },

                // delete entry if mail  found
                function(result, cbk){
                    
                    if(result && result.recordset && result.recordset.length){
                        if(result.recordset[0].replyTime){
                            Util.writeLogs(`Reply Time updated in db. Please remove the email from outlook :  ${result.recordset[0].subject}, emailId : ${result.recordset[0].id}`)
                            cbk(null,null);
                        }else{
                            app.db.query(
                                `DELETE from emails WHERE id=${result.recordset[0].id}`,
                                (err4, updated) => {
 app.db.query(
                                        `DELETE from emails WHERE subject='${email.subject}' AND mailFrom LIKE '%${email.mailFrom}%' AND receivedTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'`,
                                        (err, result) => {
                                          console.log(`DELETE from emails WHERE subject='${email.subject}' AND mailFrom LIKE '%${email.mailFrom}%' AND receivedTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'`)
                                          app.db.query(
                                            `SELECT * FROM emails WHERE subject='${email.subject}' AND mailFrom LIKE '%${email.mailFrom}%' AND receivedTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'`,
                                            (err1, result1) => {
                                                if(err1){
                                                    cbk(null,null)
                                                }else {
                                                    cbk(null,result1);
                                                }
                                            }   
                                        )
                                    })
				}
                            );
                        }
                    }else{
                        cbk(null, result);
                    }
                },

                // create entry if mail not found
                function(result, cbk){
                    if(result &&  result.recordset && !result.recordset.length){
                        tickets.getActivityId(app, function (ticket_no) {
                            r.activityId = ticket_no;
                            tickets.getCaseId(app, function (caseId) {
                            r.caseId = caseId;
                            r.body = r.body.replace(/'/g, '"');
                                createEmail( app, r, () => {
                                    cbk(null, result);
                                })
                            });
                        });
                    }else{
                        cbk(null,result);
                    }
                }

            ], function(){
                CBK()
            })

        }else{
            CBK()
        }
    },function(){
        emailCbk()
    })
}


function createEmail(app, r, cbk){
    app.db.query(
        `INSERT INTO
          emails (caseId,activityId,mailFrom,groupId,uid,body,receivedTime,subject,isForword,subjectOri)
        VALUES
          (
            '${r.caseId}',${r.activityId},'${r.mailFrom.toLowerCase()}',${r.groupId},
            ${r.uid},'${r.body}',
            '${moment(r.receivedTime).format('YYYY-MM-DD HH:mm:ss')}',
            '${r.subject}','false','${r.subjectOri}'
          )`,
        (err5, added) => {
          if (err5) {
            cbk();
          } else {
            cbk();
          }
        }
    );
}

function emailMovetoAgentFolder ( app , imapConnection, CBK ){

    async.waterfall([

        // get unforwarded emails from db
        function(cbk){
            getUnForwardEmailsFromDB( app, (err, result) => {
                if(err){
                    cbk(null,null)
                }else {
                    cbk(null, result)
                }
            })  
        },

        // Iterate unforwarded  emails
        function(result, cbk){
            if(result && result.recordset && result.recordset.length ){
                iterateUnForwardEmails( app, result.recordset,imapConnection, (err, result) => {
                    if(err){
                        cbk(null, null)
                    }else {
                        cbk(null,null)
                    }
                })  
            }else{
                cbk(null,null)
            }
        },

    ], () => {
        CBK()
    })
}

function iterateUnForwardEmails(app,emails,imapConnection, CBK){

    async.forEachSeries(emails,  function (e, cbk  ) {
        if(e && e.agentId && e.forwardTime ){
            cbk();
        }else{
            startProcessToMoveEmailToAgent( app, e ,imapConnection, () => {
                cbk();
            })  
        }

    }, () => {
        CBK()
    })
}

function startProcessToMoveEmailToAgent(app, e ,imapConnection, CBK){

    async.waterfall([

        // get agent
        function(cbk){
            getAgent.getAgent(app , e , function( agent ){
                if(agent && agent.id){
                    cbk(null,agent)
                }else{
                    cbk(null,null)
                }
            })
        },

        // move email to agent folder 
        function(agent, cbk){
            if(agent && agent.name){
                imap.mailToAnotherFolder( imapConnection , e.uid ,  e.groupName , e.groupName+"/"+e.groupName+" - "+agent.name  , async function(emailMoveErr , emailMoveRes ){
                    if(emailMoveErr){
                        cbk(null, null)
                    }else{
                        cbk(null,agent)
                    }
                })
            }else{
                cbk(null, agent)
            }
        },

        // update agentId and forwardTime in db
        function(agent, cbk){
            if(agent && agent.name ){
                app.db.query(
                    `UPDATE emails SET agentId= ${agent.id},isForword='true',forwardTime='${moment().format('YYYY-MM-DD HH:mm:ss' )}'
                     WHERE caseId ='${e.caseId}'`,
                    (err4, updated) => {
                        cbk(null,null)
                    }
                );
            }else{
                cbk(null,null)
            }
        }


    ], () => {
        CBK()
    })
}

function getUnForwardEmailsFromDB(app, cbk){
    app.db.query(`
        SELECT
            emails.uid,
            emails.groupId,
            emails.agentId,
            groups.name as groupName,
            emails.caseId,
            emails.isReplyMail,
            emails.subject,
            emails.forwardTime
        FROM
            (emails LEFT JOIN groups ON  emails.groupId = groups.id)
        WHERE
            isForword=0 
        ORDER BY
            receivedTime ASC`,
        (notMoveEmailErr , notMoveEmailRes ) =>{

            cbk(notMoveEmailErr , notMoveEmailRes )
    })
}



module.exports = skillGroupEmails;
