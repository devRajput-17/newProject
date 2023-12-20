const async = require('async');
const moment = require('moment');
const _ = require('underscore');
var Imap = require('imap');
var Util = require('../util');
var imap = require('../handlers/imap');


function moveToCompleteEmails(app) {

    app.server.get('/stuck/emails/moveToComplete', async function (req, res) {
        Util.writeLogs("Status of Agent Folder Imap Connection : " + agentFolderEmailImapConnection.state);
        if(agentFolderEmailImapConnection.state != 'authenticated'){
            await Util.createAgentFolderRoutingImapConnection();
            res.send( {
                statusCode :201,
                status : "failure",
                message : "Exchange Server is busy. Please retry."
            })
        }
        Util.writeLogs('Start move to complete Routing');
        moveToCompleteEmailRouting(app, agentFolderEmailImapConnection, () => {
            Util.writeLogs('End move to complete Routing')
            res.send( {
                statusCode :200,
                status : "Success"
            })
        });
    });
   
}

function moveToCompleteEmailRouting ( app , imapConnection ,  CBK){
  
    async.waterfall([

        function(cbk){
            getGroup(app,(groups)=> {
                console.log(groups.length , "groups")
                cbk( null, groups)
            })
        },
       
       
        function(groups, cbk){
            async.forEachSeries(groups,  function (group,  groupCbk  ) {
                getAgent(app, group, (agents)=> {
                    console.log(agents.length,"agents")
                    if(agents && agents.length){
                        async.forEachSeries(agents,  function (agent,  agentcbk  ) {
                            getMailsFromDB(app, group,agent, ( completedEmails)=> {
                                console.log(completedEmails.length , "completedEmails")
                                if(completedEmails && completedEmails.length){
                                    var folderName = group.name+"/"+group.name+" - "+agent.name;

                                    imap.getEmails( imapConnection , folderName, function (agentEmails) {
                                        async.forEachSeries(completedEmails,  function (email,  completedEmailCbk  ) {
                                                getRepliedEmails( agentEmails, email, (repliedEmail)=> {
                                                   
                                                    if(repliedEmail){
                                                        console.log(repliedEmail , "repliedEmail")
                                                        moveToCompletedFolder(imapConnection, repliedEmail, folderName,() => {
                                                            completedEmailCbk()
                                                        })
                                                    }else{
                                                   
                                                        completedEmailCbk()
                                                    }
                                                })
                                            
                                        },function(){
                                            agentcbk(null, null)
                                        })
                                    })
                                }else{
                                    agentcbk(null,null)
                                }
                            })
                        },function(){
                            groupCbk()
                        })
                    }else{
                        groupCbk()
                    }
                })
            },function(){
                cbk()
            })
        },
    ], () => {
        CBK()
    })
}


function getGroup(app, cbk){
    app.db.query(`SELECT * FROM groups `, (err, group) => {
        if (group && group.recordset && group.recordset.length) {
            cbk(group.recordset)
        }else{
            cbk([])
        }
    })
}

function getAgent(app, group, cbk){
    app.db.query(`SELECT * FROM agent WHERE groupIds='[${group.id}]' `, (err, agent) => {

        if (agent && agent.recordset && agent.recordset.length) {
            cbk(agent.recordset)
        }else{
            cbk([] )
        }
    })
}


function matchEmail(inputMail,email, matchWithDbEmail,  cbk){

    let subjectMatch = false;
    let mailFromMatch = false;
    let timeMatch = false;

    const agentFolderSubject   = Util.modifySubject(email.subject);
    const inputSubject    = Util.modifySubject(inputMail.subject);
    const agentFolderMailFrom   = Util.modifyMailFrom(email.mailFrom).toLowerCase();
    const inputMailFrom   = Util.modifyMailFrom(inputMail.mailFrom).toLowerCase();
    const agentFolderReceivedTime   = new Date(Util.modifyTime(email.receivedTime )).getTime();
    const inputReceivedTime = new Date(Util.modifyTime(inputMail.receivedTime )).getTime();
    
    subjectMatch = Util.isMatched(agentFolderSubject , inputSubject );
    

    if(subjectMatch){

        mailFromMatch = Util.isMatched(agentFolderMailFrom , inputMailFrom );
        timeMatch = Util.isMatched(agentFolderReceivedTime , inputReceivedTime );

        console.log( "subjectMatch " , subjectMatch , email.subject , inputMail.subject );
        console.log( "mailFromMatch " , mailFromMatch , email.mailFrom,inputMail.mailFrom )
        console.log( "timeMatch " , timeMatch , email.receivedTime  , inputMail.receivedTime )

        if(subjectMatch && mailFromMatch && timeMatch ){

            cbk(inputMail)

        }else{
            cbk(null)
        }
    }else{
        cbk(null)
    }

}

function getRepliedEmails(emails, input,  emailCbk){

    let repliedEmail ;

    async.forEachSeries(emails,  function (email,  agentMailCbk  ) {

        matchEmail(input,email, false, function( matchEmailResult ){

            matchEmailResult ? repliedEmail = matchEmailResult  : '' ;

            agentMailCbk();
        })

    },function(){
        emailCbk(repliedEmail)
    })
}

function getMailsFromDB(app, group, agent, emailCbk ){

    app.db.query(`
        SELECT
            emails.subject, 
            emails.subjectOri, 
            emails.forwardTime,
            emails.receivedTime,
            emails.replyTime,
            emails.mailFrom,
            emails.agentId,
            emails.groupId,
            agent.name as 'agentName',
            groups.name as 'groupName'
        FROM emails 
            JOIN groups ON groups.id=emails.groupId  
            JOIN agent ON agent.id=emails.agentId
        WHERE
            replyTime IS NOT NUll AND 
            receivedTime != replyTime AND
            emails.agentId = ${agent.id} AND
            emails.groupId = ${group.id} AND
            replyTime >= DATEADD(day,-10, GETDATE()) AND
            replyTime < DATEADD(day,-1, GETDATE())
        ORDER BY
            emails.agentId DESC` ,
    (replyEmailsErr , replyEmailsRes ) =>{
        
        if ( replyEmailsRes && replyEmailsRes.recordset && replyEmailsRes.recordset.length ) {
            emailCbk( replyEmailsRes.recordset)
        }else{
            emailCbk([])
        }

    })

    
}

function moveToCompletedFolder(imapConnection,email,boxName, callback){
    imap.mailToAnotherFolder( imapConnection , email.uid ,boxName ,boxName+"/Completed", (emailMoveErr , emailMoveRes) =>{
        callback()
    })
}

module.exports = moveToCompleteEmails;
