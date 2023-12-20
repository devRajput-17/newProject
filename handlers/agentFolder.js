const async = require('async');
const moment = require('moment');
const _ = require('underscore');
var Imap = require('imap');
var Util = require('../util');
var imap = require('../handlers/imap');


function agentFolderEmails(app) {

    app.server.post('/stuck/emails/agentFolder1', async function (req, res) {
        Util.writeLogs("Status of Agent Folder Imap Connection : " + agentFolderEmailImapConnection.state)
        if(agentFolderEmailImapConnection.state != 'authenticated'){
            await Util.createAgentFolderRoutingImapConnection();
            res.send( {
                statusCode :201,
                status : "failure",
                message : "Exchange Server is busy. Please retry."
            })
        }
        Util.writeLogs('Start Agent Folder Routing');
        agentFolderEmailRouting(app, agentFolderEmailImapConnection,req.body, () => {
            Util.writeLogs('End Agent Folder Routing')
            res.send( {
                statusCode :200,
                status : "Success"
            })
        });
    });


      app.server.post('/stuck/emails/agentFolder', async function (req, res) {
        Util.writeLogs("Status of Move To Complete Imap Connection : " + agentFolderEmailImapConnection.state)
        if(agentFolderEmailImapConnection.state != 'authenticated'){
            await Util.createAgentFolderRoutingImapConnection();
            res.send( {
                statusCode :201,
                status : "failure",
                message : "Exchange Server is busy. Please retry."
            })
        }
        Util.writeLogs('Start Move To CompleteAgent Folder Routing');
        moveToFolder(app, agentFolderEmailImapConnection,req.body, () => {
            Util.writeLogs('End Move To Complete Agent Folder Routing')
            res.send( {
                statusCode :200,
                status : "Success"
            })
        });
    });

   
}


function moveToFolder( app , imapConnection , input, CBK){
    if(input && input.groupName){
        console.log('input',input)
        var boxName =  input.groupName  + "/" + input.groupName + " - " + input.agentName ;
        var moveFolderName = input.type === "completed" ?  boxName + "/Completed" :  "Re-Assigned" ;
        console.log(input , "inputinputinput");

        const uids = _.pluck( input.emails, "uid")
        imapConnection.openBox( boxName , function(err , box){
            if (err) {
                Util.writeLogs( "Email Move error :" + err.message );
                console.log(err );
                CBK( );
            }else{
                console.log( uids ,boxName, moveFolderName )
                imapConnection.move(uids, moveFolderName , function(err3, code) {
                    if (err3) {
                        Util.writeLogs( "Email Move error :" + err3.message );
                        console.log(err3 );
                        CBK();
                    } else  {
                        Util.writeLogs( "Mail moved to "+moveFolderName+" folder");

                        console.log( input.type === "completed" )

                        if( input.type === "completed" ){
                            console.log( 'enter herer')
                            updateReplyTimeToDB(app, input, function(){
                                CBK( );
                            })
                        }else{
                            CBK( );
                        }
                    
                    } 
                });
            }
        });
    }else{
        CBK()
    }
       
}

function updateReplyTimeToDB(app, input, callback){

    console.log( input.emails.length, "fgggggggggggggggg")
    async.forEachSeries(input.emails,  function (email,  completedEmailCbk  ) {
        console.log('input emails',input.emails)

        console.log('input emails',email)

        const actualSubject = email.subject.trim().replace(/'/g, '"')  ;

        const modifiedSubject = Util.modifySubject(email.subject);

        const mailFrom = email.mailFrom.includes('<') ? email.mailFrom.split('<')[1].split('>')[0] :email.mailFrom;  ; 
        console.log('input mailFrom',mailFrom)

        var min  = Math.floor(Math.random() * 30 )
           
        console.log(min , "min")


	

        app.db.query(
            `UPDATE emails 
            //SET replyTime = DATEADD(mi, FLOOR(RAND()*(30-5+1)+5)  ,(select receivedTime from emails b where emails.id = b.id)) 
            SET replyTime='${moment(email.receivedTime).format('YYYY-MM-DD HH:mm:ss')}'
            WHERE 
             
            replyTime is null and 
            (mailFrom LIKE '%${mailFrom}%' OR mailFrom LIKE '%${mailFrom.toLowerCase()}%' )  AND 
            subject IN (
                '${actualSubject}',
                '${modifiedSubject}',
                'RE: ${modifiedSubject}',
                'RE:${modifiedSubject}',
                'RE ${modifiedSubject}',
                'Re: ${modifiedSubject}',
                'Re:${modifiedSubject}',
                'Re ${modifiedSubject}',
                're: ${modifiedSubject}',
                're:${modifiedSubject}',
                're ${modifiedSubject}',
                'FW: ${modifiedSubject}',
                'FW:${modifiedSubject}',
                'FW ${modifiedSubject}',
                'Fw: ${modifiedSubject}',
                'Fw:${modifiedSubject}',
                'Fw ${modifiedSubject}',
                'fw: ${modifiedSubject}',
                'fw:${modifiedSubject}',
                'fw ${modifiedSubject}',
                'FWD: ${modifiedSubject}',
                'FWD:${modifiedSubject}',
                'FWD ${modifiedSubject}',
                'Fwd: ${modifiedSubject}',
                'Fwd:${modifiedSubject}',
                'Fwd ${modifiedSubject}',
                'fwd: ${modifiedSubject}',
                'fwd:${modifiedSubject}',
                'fwd ${modifiedSubject}'
            )
           `,
        (replyEmailsErr , replyEmailsRes ) =>{
            completedEmailCbk();
        })
    },function(){
        callback()
    })
   
}

function agentFolderEmailRouting ( app , imapConnection , input, CBK){
   //input =  {'groupId': 2 , 'agentId': 21 , 'emails':  [] };
    async.waterfall([

        // Get group
        function(cbk){
            getGroup(app,input, (group)=> {
                // console.log(group, "group")

                cbk( null, group)
            })
        },

        // Get agent
        function(group, callback){
            if(group && group.id){
                getAgent(app, input, (agent)=> {
                     console.log(agent, "agent")
                    callback( null, { group:group, agent:agent })
                })
            }else{
                callback( null, { group :group, agent : null })
            }
        },

        //get agent emails from imap
        function( oneDoc,  cbk){
            console.log("onedoc",oneDoc)
            if(oneDoc && oneDoc.group && oneDoc.group.id && oneDoc.agent && oneDoc.agent.id ){
                var folderName = oneDoc.group.name+"/"+oneDoc.group.name+" - "+oneDoc.agent.name;
                console.log('folderName', folderName)
                imap.getEmails( imapConnection , folderName, function (emails) {
                    oneDoc['emails'] = emails;

                    console.log(emails.length, "emails")
                     //input['emails'] = emails;
                    cbk( null,oneDoc )
                })
            }else{
                cbk(null, oneDoc)
            }
        },

        //get replied emails
        function(oneDoc, cbk){
            if(oneDoc && oneDoc.group && oneDoc.group.id && oneDoc.agent && oneDoc.agent.id && oneDoc.emails && oneDoc.emails.length ){
                getRepliedEmails(app, oneDoc.emails, input, (repliedEmails)=> {
                    oneDoc['repliedEmails'] = repliedEmails;
                    console.log(repliedEmails.length, "repliedEmails")

                    cbk( null,oneDoc )
                })
            }else{
                cbk(null, oneDoc)
            }
        },

        // get replied mails from db
        function(oneDoc, cbk){
            if(oneDoc && oneDoc.group && oneDoc.group.id && oneDoc.agent && oneDoc.agent.id && oneDoc.repliedEmails && oneDoc.repliedEmails.length ){
                getMailsFromDB(app, oneDoc.repliedEmails ,oneDoc.agent.id, oneDoc.group.id, ( completedEmails)=> {
                    oneDoc['completedEmails'] = completedEmails;
                    console.log(completedEmails.length, "completedEmails")

                    cbk( null,  oneDoc)
                })
            }else{
                cbk( null,  oneDoc)
            }
        },

        //update replyTime in db 
        function(oneDoc, cbk){
            if(oneDoc && oneDoc.group && oneDoc.group.id && oneDoc.agent && oneDoc.agent.id && oneDoc.repliedEmails && oneDoc.repliedEmails.length && 

            oneDoc.completedEmails && oneDoc.completedEmails.length ){
                async.forEachSeries(oneDoc.completedEmails,  function (email,  completedEmailCbk  ) {
                    var folderName = oneDoc.group.name+"/"+oneDoc.group.name+" - "+oneDoc.agent.name;
                    moveToCompletedFolder(imapConnection,email.agentFolderEmail, folderName,() => {
                        async.forEachSeries(email.dbEmail,  function (dbEmail,  completedEmailCbk1  ) {
                            updateReplyTime( app, dbEmail, ()=>{
                                completedEmailCbk1()
                            })
                        },function(){
                            completedEmailCbk()
                        })
                    })
                   
                },function(){
                    cbk(null, null)
                })
            }else if(oneDoc && oneDoc.group && oneDoc.group.id && oneDoc.agent && oneDoc.agent.id && oneDoc.repliedEmails && oneDoc.repliedEmails.length && 

                oneDoc.completedEmails && !oneDoc.completedEmails.length ){
                async.forEachSeries(oneDoc.repliedEmails,  function (email,  completedEmailCbk  ) {
                    var folderName = oneDoc.group.name+"/"+oneDoc.group.name+" - "+oneDoc.agent.name;
                    moveToCompletedFolder(imapConnection,email, folderName,() => {
                        completedEmailCbk()
                    })
                   
                },function(){
                    cbk(null, null)
                })
            }else{
                cbk(null,null)
            }
        },
    ], () => {
        CBK()
    })
}


function getGroup(app,input, cbk){
    app.db.query(`SELECT * FROM groups WHERE id=${input.groupId}`, (err, group) => {
        if (group && group.recordset && group.recordset.length) {
            var groupArray =  group.recordset;
            cbk(groupArray[0])
        }else{
            cbk(null)
        }
    })
}

function getAgent(app,input, cbk){
    // app.db.query(`SELECT * FROM agent WHERE groupIds='[${input.groupId}]' AND id=${input.agentId}`, (err, agent) => {
    app.db.query(`SELECT * FROM agent WHERE id=${input.agentId}`, (err, agent) => {

        if (agent && agent.recordset && agent.recordset.length) {
            var agentArray =  agent.recordset;
            cbk(agentArray[0])
        }else{
            cbk(null )
        }
    })
}

function getRepliedEmails(app, emails, input,  emailCbk){

    let repliedEmails = [];

    async.forEachSeries(emails,  function (email,  agentMailCbk  ) {

        if(input.emails && input.emails.length){
            async.forEachSeries(input.emails,  function (inputMail,  inputCbk  ) {
                
                matchEmail(inputMail,email, false, function( matchEmailResult ){

                    // console.log(matchEmailResult, "matchEmailResult")

                    matchEmailResult ? repliedEmails.push(matchEmailResult ) : '' ;

                    inputCbk();
                }  )

            },function(){
                agentMailCbk()
            })
        }else{
            agentMailCbk()
    }

    },function(){
        emailCbk(repliedEmails)
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
    const inputReceivedTime = matchWithDbEmail ?     new Date(inputMail.receivedTime).getTime() : new Date(Util.modifyTime(inputMail.receivedTime )).getTime();
    //const inputReceivedTime = new Date(Util.modifyTime(inputMail.receivedTime )).getTime();
    subjectMatch = Util.isMatched(agentFolderSubject , inputSubject );
    mailFromMatch = Util.isMatched(agentFolderMailFrom , inputMailFrom );
    timeMatch = Util.isMatched(agentFolderReceivedTime , inputReceivedTime );

    console.log( "subjectMatch " , subjectMatch )
    console.log( "mailFromMatch " , mailFromMatch )
    console.log( "timeMatch " , timeMatch , email.receivedTime  , inputMail.receivedTime )

    if(subjectMatch && mailFromMatch && timeMatch ){

        cbk(email)

    }else{
        cbk(null)
    }

}

function getMailsFromDB(app,repliedEmails,agentId,groupId, emailCbk ){

    let completedEmails = []

    async.forEachSeries(repliedEmails,  function (email,  agentMailCbk  ) {

        let oneDoc = {
            agentFolderEmail : email,
            dbEmail : [] 
        }

        let subject =  Util.modifySubject(email.subject );

        app.db.query(`
        SELECT
            emails.subject,emails.mailFrom,emails.forwardTime, 

emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id
        FROM emails
        WHERE
            forwardTime IS NOT NULL 
            --AND replyTime IS NULL  
            AND emails.subject like '%${subject}%'
            AND agentId=${agentId}
            AND groupId=${groupId}
        ORDER BY
            receivedTime ASC` ,
        (replyEmailsErr , replyEmailsRes ) =>{

            console.log(replyEmailsErr , replyEmailsRes, "replyEmailsErr , replyEmailsRes")
            console.log(`
            SELECT
                emails.subject,emails.mailFrom,emails.forwardTime, 

emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id
            FROM emails
            WHERE
                forwardTime IS NOT NULL 
                --AND replyTime IS NULL  
                AND emails.subject like '%${subject}%'
                AND agentId=${agentId}
                AND groupId=${groupId}
            ORDER BY
                receivedTime ASC`)

            if(replyEmailsRes && replyEmailsRes.recordset && replyEmailsRes.recordset.length ){
                Util.writeLogs( `Reply Email Count :  ${replyEmailsRes.recordset.length} For Subject :  ${subject}`);
                
                async.forEachSeries(replyEmailsRes.recordset ,  function (inputMail,  inputCbk  ) {

                    matchEmail(inputMail,email, true, function( matchEmailResult ){
        
                        matchEmailResult ? oneDoc.dbEmail.push(inputMail)  : '' ;
                        
                        inputCbk();
                    }  )
        
                },function(){
                    completedEmails.push( oneDoc)
                    agentMailCbk()
                })

            }else{
                app.db.query(`
                SELECT
                    emails.subject,emails.mailFrom,emails.forwardTime, 

emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id
                FROM emails
                WHERE
                    forwardTime IS NOT NULL 
                   -- AND replyTime IS NULL  
                    AND emails.subject='${subject}'
                    AND agentId=${agentId}
                    AND groupId=${groupId}
                ORDER BY
                    receivedTime ASC` ,
                (replyEmailsErr1 , replyEmailsRes1 ) =>{
        
                    if(replyEmailsRes1 && replyEmailsRes1.recordset && replyEmailsRes1.recordset.length ){
                        Util.writeLogs( `Reply Email Count :  ${replyEmailsRes1.recordset.length} For Subject :  ${subject}`);
                       
                        async.forEachSeries(replyEmailsRes1.recordset ,  function (inputMail,  inputCbk  ) {

                            matchEmail(inputMail,email, true, function( matchEmailResult1 ){
                                matchEmailResult1 ? oneDoc.dbEmail.push(inputMail)  : '' ;
                                inputCbk();
                            }  )
                
                        },function(){
                            completedEmails.push( oneDoc)
                            agentMailCbk()
                        })
        
                    }else{
                        subject = subject.split('[').join('\\[');
                        app.db.query(`
                        SELECT
                            emails.subject,emails.mailFrom,emails.forwardTime, 

emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id
                        FROM emails
                        WHERE
                            forwardTime IS NOT NULL 
                            --AND replyTime IS NULL  
                            AND emails.subject like '%${subject}%' ESCAPE '\\'
                            AND agentId=${agentId}
                            AND groupId=${groupId}
                        ORDER BY
                            receivedTime ASC` ,
                        (replyEmailsErr2 , replyEmailsRes2 ) =>{
                
                            if(replyEmailsRes2 && replyEmailsRes2.recordset && replyEmailsRes2.recordset.length ){
                                Util.writeLogs( `Reply Email Count :  ${replyEmailsRes2.recordset.length} For Subject :  ${subject}`);
                               
                                async.forEachSeries(replyEmailsRes2.recordset ,  function (inputMail,  inputCbk  ) {

                                    matchEmail(inputMail,email, true, function( matchEmailResult2 ){
                        
                                        matchEmailResult2 ? oneDoc.dbEmail.push(inputMail)  : '' ;

                                        inputCbk();
                                    }  )
                        
                                },function(){
                                    completedEmails.push( oneDoc)
                                    agentMailCbk()
                                })
                            }else{
                                agentMailCbk()
                            }
                        })
                    }
                })
            }
        })

    },function(){
        emailCbk(completedEmails)
    })
}

function updateReplyTime(app, email, callback){

    app.db.query(
        `UPDATE emails SET replyTime = DATEADD(mi, 1,(select receivedTime from emails b where emails.id = b.id)) WHERE caseId ='${email.caseId}' and id=

${email.id} and replyTime is null`,
        (replyTimeErr, replyTimeRes) => 
        {
            if(replyTimeErr){
                callback( replyTimeErr, null)
            }else{
                callback( null, replyTimeRes)
            }
        }   
    )
}

function moveToCompletedFolder(imapConnection,email,boxName, callback){
    imap.mailToAnotherFolder( imapConnection , email.uid ,boxName ,boxName+"/Completed", (emailMoveErr , emailMoveRes) =>{
        callback()
    })
}

module.exports = agentFolderEmails;
