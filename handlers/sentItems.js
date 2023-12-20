const async = require('async');
const moment = require('moment');
const _ = require('underscore');
var Imap = require('imap');
var Util = require('../util');
var imap = require('../handlers/imap');


function sentItemsEmails(app) {

    app.server.get('/stuck/emails/sentItems', async function (req, res) {
        Util.writeLogs("Status of Sent Items Imap Connection : " + sentItemsEmailImapConnection.state)
        if(sentItemsEmailImapConnection.state != 'authenticated'){
            await Util.createSentItemsRoutingImapConnection();
            await Util.updateAction( app , 'sentItems' , false )
            return res.send(201)
        }
        var isAction = await Util.checkAction( app , 'sentItems')
        // if(isAction) return res.send(201)
        sentItemEmailRouting(app, sentItemsEmailImapConnection, () => {
            res.send(200)
        });
    });
   
}

function sentItemEmailRouting ( app , imapConnection, CBK ){
    async.waterfall([

        // Get emails from sent items
        function(cbk){
            getSendItemsEmails( imapConnection , function (err, emails) {
                cbk(null, emails)
            })
        },

        // iterate emails
        function(emails,cbk){
            if(emails && emails.length){
                iterateEmails(emails, app, imapConnection, (agent)=> {
                    cbk( null,null)
                })
            }else{
                cbk( null,null)
            }
        },

       
    ], () => {
        CBK()
    })
}

function getSendItemsEmails(imapConnection ,callback ){
    let resData = []; 

    Util.writeLogs(`Trying to open ${process.env.SENT_MAIL_BOX_NAME}... `);

    imapConnection.openBox( process.env.SENT_MAIL_BOX_NAME , function(err , box){
        if (err) {
            Util.writeLogs( "Retrieve sent Items emails err:" + err.message );
            callback(err , resData );
        }
        else if( box && box.messages && box.messages.total ){
        
            Util.writeLogs( "Retrieve sent Items emails count :" + box.messages.total );

           var startSeq = Math.floor(Math.random() * (box.messages.total ))
           var endSeq = startSeq + 30 >  box.messages.total ? '*' : startSeq + 30;
           var d = new Date();
           var n = d.getMinutes()  ;
           if( n % 2 == 0 ){
                startSeq = box.messages.total >= 30  ? box.messages.total-29 : 1 ;
                endSeq = '*'
           }
         
            try {

                var head = imapConnection.seq.fetch( startSeq + ':' + endSeq , {
                    bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE CC BCC)']
                });
                var body = imapConnection.seq.fetch(startSeq + ':' + endSeq,  {
                    bodies: ""
                });

                head.on('message', function (msg, seqno) {
                    msg.on('body', function (stream, info) {
                        var buffer = '';
                        stream.on('data', function (chunk) {
                            buffer += chunk.toString('utf8');
                        });
                        stream.once('end', function () {
                            let h = (Imap.parseHeader(buffer));
                            
                            const sentItemSubject =  h.subject && h.subject.length ? h.subject[0].replace(/\n/g , '').trim().toLowerCase() : '';
                            const replyEmail =  sentItemSubject.startsWith('re ') ? true :  sentItemSubject.startsWith('re:') ? true : false; 
                            const fowardedEmail =  sentItemSubject.startsWith('fw ') ? true :  sentItemSubject.startsWith('fw:') ? true : sentItemSubject.startsWith('fwd ') ? true :  sentItemSubject.startsWith('fwd:') ? true : false; 

                            msg.once('attributes', function (attrs) {
                                var headers = {
                                    mailFrom : h && h.from && h.from.length ?  h.from[0] : '',
                                    receivedTime : h && h.date && h.date.length ?  h.date[0] : '',
                                    subject: h &&  h.subject && h.subject.length ?  (h.subject[0]).replace(/\n/g , '').trim() : '',
                                    uid : attrs.uid,
                                    fowardedEmail:fowardedEmail,
                                    replyEmail:replyEmail,
                                    to:  h && h.to && h.to.length ?  h.to[0] : '',
                                    cc:  h && h.cc && h.cc.length ? h.cc[0].split(','): '' ,
                                    bcc: h && h.bcc && h.bcc.length ? h.bcc[0].split(',') : '',
                                    allTo :  h && h.to && h.to.length ? h.to[0].split(','): '' 
                                }
                               resData.push(headers);
						 //var receivedTime = new Date(Util.modifyTime(headers.receivedTime )).getTime();
                                 //var time =  new Date(new Date().setHours(0,0,0,0)).getTime();


                                 //if( time > receivedTime ){
                                   //  resData.push(headers);
                                 //}else{
                                   //  console.log( headers.receivedTime )
                                 //}
                            });
                           
                        });
                    });
                });

                body.on('message', function (msg, seqno) {
                    msg.on('body', function (stream, info) {
                        var bodyHtml = '';
                        stream.on('data', function (chunk) {
                            bodyHtml += chunk.toString('utf8');
                        });
                        stream.once('end', function () {      
                            msg.once('attributes', function (attrs) {
                                if(resData && resData.length){
                                    var index = _.findIndex(resData , {uid : attrs.uid});
                                    var index1 = bodyHtml.indexOf('<div ');
                                    bodyHtml = bodyHtml.substring(index1 , bodyHtml.length);
                                    bodyHtml = bodyHtml.replace(/=C2=A0/g , '\r\n');
                                    bodyHtml = bodyHtml.replace(/=\r\n/g , '');
                                    bodyHtml = bodyHtml.split('\r\n\r\n--')[0];
                                    if(resData[index]){
                                        resData[index].body = bodyHtml;
									 //	var receivedTime = new Date(Util.modifyTime(resData[index].receivedTime )).getTime();
                                 //var time =  new Date(new Date().setHours(0,0,0,0)).getTime();


                                // if( time > receivedTime ){
                                    // resData[index].body = bodyHtml;
                                 //}else{
                                    // console.log( headers.receivedTime )
                                // }
                                    }
                                }
                            });
                        });
                    });
                });

                body.once('end', function () {
                    callback(null, resData);
                });
            } catch (errorWhileFetching) {
                console.log("Error occured while retrieving mails from " + process.env.SENT_MAIL_BOX_NAME + " " + errorWhileFetching);

                Util.writeLogs(`Error occured while retrieving mails from ${process.env.SENT_MAIL_BOX_NAME}`);
                callback(null, resData);
            }
        }
        else{
            Util.writeLogs( "Retrieve sent Items emails count : 0 "  );
            callback(null , resData );
        }
    })
}

function iterateEmails(emails,app, imapConnection, emailCbk){

    async.forEachSeries(emails,  function (email,  agentMailCbk  ) {
        const sentItemSubject = Util.modifySubject(email.subject);
        console.log( sentItemSubject , "sentItemSubject")
        if(sentItemSubject){

            async.waterfall([

                function(cbk){
                    getMailsFromDB(app,email, function(matchedEmails){
                        console.log('1')
                        cbk(null, matchedEmails )
                    })
                },
                function(matchedEmails, cbk){
                    console.log('2');
                    console.log(matchedEmails , "matchedEmails")
                    if(matchedEmails && matchedEmails.length){
                        async.forEachSeries(matchedEmails,  function (matchedEmail,  mailCbk  ) {
                            let boxName = matchedEmail.groupName+"/"+matchedEmail.groupName+" - "+matchedEmail.agentName;
                            getMailsFromAgentFolder(app,email,matchedEmail, boxName,imapConnection, function(){
                                mailCbk( null, null )
                            })
                        },() => {
                            cbk(null,null)
                        })
                        // cbk(null,null)
                    }else{
                        console.log('4')
                        moveToRepliedFolder( email,imapConnection, () => {
                            cbk(null,null)
                        })
                    }
                   
                }

            ], () => {
                agentMailCbk(null,email)
            })

        }else{
            console.log('3')
            moveToRepliedFolder( email,imapConnection, () => {
                agentMailCbk(null,email)
            })
        }

    },function(){
        emailCbk()
    })
}

function getMailsFromAgentFolder(app, sentItem, dbEmail, boxName, imapConnection, CBK){

    imap.getEmails( imapConnection , boxName, (agentEmails) =>{

        if(agentEmails && agentEmails.length){
            let matchFound =false;
            async.forEachSeries(agentEmails,  function (email,  agentMailCbk  ) {

                let subjectMatch = false;
                let mailFromMatch = false;
                let timeMatch = false;
            
                const inputSubject    = Util.modifySubject(dbEmail.subject);
                const agentFolderSubject   = Util.modifySubject(email.subject);
                const inputMailFrom   = Util.modifyMailFrom(dbEmail.mailFrom).toLowerCase();
                const agentFolderMailFrom   = Util.modifyMailFrom(email.mailFrom).toLowerCase();
                const inputReceivedTime   = new Date(Util.modifyTime(dbEmail.receivedTime) ).getTime();
                const agentFolderReceivedTime  =   new Date(Util.modifyTime(email.receivedTime )).getTime();

               

                subjectMatch = Util.isMatched(agentFolderSubject , inputSubject );
                mailFromMatch = Util.isMatched(agentFolderMailFrom , inputMailFrom );
                timeMatch = Util.isMatched(agentFolderReceivedTime , inputReceivedTime );

                if(subjectMatch){
                    console.log(  agentFolderSubject ,inputSubject)
                    console.log(  agentFolderMailFrom ,inputMailFrom)
                    console.log(  new Date(agentFolderReceivedTime) , new Date(inputReceivedTime) )
                    console.log(  new Date(dbEmail.receivedTime) , new Date(email.receivedTime) )

                    console.log( '!!!! subjectMatch : ' , subjectMatch );
                    console.log( '!!!! mailFromMatch : ' , mailFromMatch )
                    console.log( '!!!! timeMatch : ' , timeMatch )
                }
            
                if(subjectMatch && mailFromMatch && timeMatch ){
                    matchFound = true ;
                    async.waterfall([

                        // update reply time
                        function(callback){
                            app.db.query(
                                `UPDATE emails SET replyTime='${moment(new Date(sentItem.receivedTime)).format('YYYY-MM-DD HH:mm:ss' )}' WHERE caseId ='${dbEmail.caseId}'`,
                                (replyTimeErr, replyTimeRes) => 
                                {

                                    console.log(replyTimeErr, replyTimeRes , "replyTimeErr, replyTimeRes")
                                    if(replyTimeErr){
                                        callback( replyTimeErr, null)
                                    }else{
                                        callback( null, replyTimeRes)
                                    }
                                }   
                            )
                        },  

                        // move to completed folder
                        function(repliedTimeUpdated, callback){
                            if(repliedTimeUpdated){
                                imap.mailToAnotherFolder( imapConnection , email.uid, boxName, boxName + "/Completed", (emailMoveErr , emailMoveRes) =>{
                                    callback(null,repliedTimeUpdated)
                                })
                            }else{
                                callback(null,repliedTimeUpdated)
                            }
                        },

                        // move to replied folder
                        function(repliedTimeUpdated ,callback){
                            if(repliedTimeUpdated){
                                moveToRepliedFolder( sentItem,imapConnection, () => {
                                    callback(null,null )
                                })

                            }else{
                                callback(null,null)
                            }
                        }

                    ],function(){
                        agentMailCbk(null,null)
                    })
            
                }else{
                    agentMailCbk(null,null)
                }
            },function(){

                if(!matchFound){
                    // app.db.query(
                    //     `UPDATE emails SET replyTime='${moment(new Date(sentItem.receivedTime)).format('YYYY-MM-DD HH:mm:ss' )}' WHERE caseId ='${dbEmail.caseId}'`,
                    //     (replyTimeErr, replyTimeRes) => 
                    //     {

                    //         console.log(replyTimeErr, replyTimeRes , "replyTimeErr, replyTimeRes")
                    //         moveToRepliedFolder( sentItem,imapConnection, () => {
                    //             CBK()
                    //         })
                    //     }   
                    // )

                    CBK()
                    
                }else{
                    CBK()
                }
                
            })
        }else{
            app.db.query(
                `UPDATE emails SET replyTime='${moment(new Date(sentItem.receivedTime)).format('YYYY-MM-DD HH:mm:ss' )}' WHERE caseId ='${dbEmail.caseId}'`,
                (replyTimeErr, replyTimeRes) => 
                {

                    console.log(replyTimeErr, replyTimeRes , "replyTimeErr, replyTimeRes")
                    moveToRepliedFolder( sentItem,imapConnection, () => {
                        CBK()
                    })
                }   
            )
           
        }
    })

}

function moveToRepliedFolder(email,imapConnection, callback){
    imap.mailToAnotherFolder( imapConnection ,email.uid, process.env.SENT_MAIL_BOX_NAME, "Replied", (emailMoveErr , emailMoveRes) =>{
        callback()
    })
}

function getMailsFromDB(app, email,  agentMailCbk ){

    let subject =  Util.modifySubject(email.subject );
    let matchedEmails = []; 
    app.db.query(`
    SELECT
        emails.subject,emails.mailFrom,emails.forwardTime, emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id,
        groups.name AS 'groupName', agent.name AS 'agentName'
    FROM 
        (emails LEFT JOIN groups ON  emails.groupId = groups.id LEFT JOIN agent ON emails.agentId = agent.id)
    WHERE
        forwardTime IS NOT NULL 
        AND replyTime IS NULL  
        AND emails.subject like '%${subject}%'
    ORDER BY
        receivedTime ASC` ,
    (replyEmailsErr , replyEmailsRes ) =>{

        if(replyEmailsRes && replyEmailsRes.recordset && replyEmailsRes.recordset.length ){
            Util.writeLogs( `Reply Email Count :  ${replyEmailsRes.recordset.length} For Subject :  ${subject}`);
            
            async.forEachSeries(replyEmailsRes.recordset ,  function (inputMail,  inputCbk  ) {

                matchEmail(inputMail,email,function( matchEmailResult ){
                    console.log(matchEmailResult , "matchEmailResult")
                    matchEmailResult ? matchedEmails.push(inputMail) : ''; 
                    inputCbk(null, email);
                }  )
    
            },function(){
                agentMailCbk(matchedEmails)
            })

        }else{
            app.db.query(`
            SELECT
                emails.subject,emails.mailFrom,emails.forwardTime, emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id,
                groups.name AS 'groupName', agent.name AS 'agentName'
            FROM 
                (emails LEFT JOIN groups ON  emails.groupId = groups.id LEFT JOIN agent ON emails.agentId = agent.id)
            WHERE
                forwardTime IS NOT NULL 
                AND replyTime IS NULL  
                AND emails.subject='${subject}'
           
            ORDER BY
                receivedTime ASC` ,
            (replyEmailsErr1 , replyEmailsRes1 ) =>{
    
                if(replyEmailsRes1 && replyEmailsRes1.recordset && replyEmailsRes1.recordset.length ){
                    Util.writeLogs( `Reply Email Count :  ${replyEmailsRes1.recordset.length} For Subject :  ${subject}`);
                    
                    async.forEachSeries(replyEmailsRes1.recordset ,  function (inputMail,  inputCbk  ) {

                        matchEmail(inputMail,email, function( matchEmailResult1 ){
                            matchEmailResult1 ? matchedEmails.push(inputMail) : ''; 
                            inputCbk( null, email);
                        }  )
            
                    },function(){
                        agentMailCbk(matchedEmails)
                    })
    
                }else{
                    subject = subject.split('[').join('\\[');
                    app.db.query(`
                    SELECT
                        emails.subject,emails.mailFrom,emails.forwardTime, emails.receivedTime,emails.agentId,emails.groupId,emails.caseId,emails.uid,emails.activityId,emails.subjectOri,emails.id,
                        groups.name AS 'groupName', agent.name AS 'agentName'
                    FROM 
                        (emails LEFT JOIN groups ON  emails.groupId = groups.id LEFT JOIN agent ON emails.agentId = agent.id)
                    WHERE
                        forwardTime IS NOT NULL 
                        AND replyTime IS NULL  
                        AND emails.subject like '%${subject}%' ESCAPE '\\'
                 
                    ORDER BY
                        receivedTime ASC` ,
                    (replyEmailsErr2 , replyEmailsRes2 ) =>{
            
                        if(replyEmailsRes2 && replyEmailsRes2.recordset && replyEmailsRes2.recordset.length ){
                            Util.writeLogs( `Reply Email Count :  ${replyEmailsRes2.recordset.length} For Subject :  ${subject}`);
                            
                            async.forEachSeries(replyEmailsRes2.recordset ,  function (inputMail,  inputCbk  ) {

                                matchEmail(email, inputMail,  function( matchEmailResult2 ){
                                    matchEmailResult2 ? matchedEmails.push(inputMail) : ''; 
                                    inputCbk( null, email);
                                }  )
                    
                            },function(){
                                agentMailCbk(matchedEmails)
                            })
                        }else{
                            agentMailCbk(matchedEmails)
                        }
                    })
                }
            })
        }
    })

    
}

function matchEmail(dbEmail, sentItem, cbk){

    let subjectMatch = false;
    let mailFromMatch = false;
    let timeMatch = false;

    const sentItemSubject   = Util.modifySubject(dbEmail.subject);
    const dbSubject    = Util.modifySubject(sentItem.subject);

    console.log(sentItemSubject , dbSubject)

    const sentItemReceivedTime   = new Date(Util.modifyTime(sentItem.receivedTime )).getTime();
    const dbReceivedTime = new Date(dbEmail.receivedTime).getTime();

    console.log(sentItemReceivedTime , dbReceivedTime)

    const DBMailFrom   = Util.modifyMailFrom(dbEmail.mailFrom).toLowerCase();

    console.log(DBMailFrom)

    subjectMatch = Util.isMatched(sentItemSubject , dbSubject );
    timeMatch =  sentItemReceivedTime >= dbReceivedTime ? true : false ;


    if(sentItem && sentItem.to && !mailFromMatch ){
        const sendItemTo   = Util.modifyMailFrom(sentItem.to).toLowerCase();
        mailFromMatch = Util.isMatched(DBMailFrom , sendItemTo );
    }
    if(sentItem && sentItem.allTo && sentItem.allTo.length && !mailFromMatch){
        for(var i=0; i< sentItem.allTo.length ; i++){
            const sendItemTo   = Util.modifyMailFrom(sentItem.allTo[i]).toLowerCase();
            if(!mailFromMatch){
                mailFromMatch = Util.isMatched(DBMailFrom , sendItemTo );
            }
        }
    }
    if(sentItem && sentItem.cc && sentItem.cc.length && !mailFromMatch){
        for(var i=0; i< sentItem.cc.length ; i++){
            const sendItemTo   = Util.modifyMailFrom(sentItem.cc[i]).toLowerCase();
            if(!mailFromMatch){
                mailFromMatch = Util.isMatched(DBMailFrom , sendItemTo );
            }
        }
    }
    if(sentItem && sentItem.bcc && sentItem.bcc.length && !mailFromMatch){
        for(var i=0; i< sentItem.bcc.length ; i++){
            const sendItemTo   = Util.modifyMailFrom(sentItem.bcc[i]).toLowerCase();
            if(!mailFromMatch){
                mailFromMatch = Util.isMatched(DBMailFrom , sendItemTo );
            }
        }
    }

    console.log( 'subjectMatch : ' , subjectMatch );
    console.log( 'mailFromMatch : ' , mailFromMatch )
    console.log( 'timeMatch : ' , timeMatch )
    if(subjectMatch && mailFromMatch && timeMatch ){
        
        cbk(true)
    }else{
        cbk(false)
    }

}

module.exports = sentItemsEmails;
