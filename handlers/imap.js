const async = require('async');
var Imap = require('imap'),
inspect = require('util').inspect;
const _ = require('underscore');
const moment = require('moment');

var Util = require('../util');

exports.getEmails = ( imapConnection , groupName , cbkGetEmail) =>{
    var resData = [];
    try{
       Util.writeLogs("Starting get emails from "+groupName)
        imapConnection.openBox(groupName, false, function(err , box){
            if (err){
                Util.writeLogs("Error for getting emails from "+groupName+" : "+ err.message)
                cbkGetEmail(resData);
            } else if( box && box.messages && box.messages.total ){
                console.log("box",box)
                imapConnection.search([['ALL']], function (err1, results) {
                    if (err1){
                        Util.writeLogs("Error for getting emails from "+groupName+" : "+ err1.message)
                        cbkGetEmail(resData);   
                    }else{
                        Util.writeLogs("Search else case ")

                        try {
                            var head =  imapConnection.seq.fetch("1:*" , {bodies: [ 'HEADER.FIELDS (FROM TO SUBJECT DATE CC BCC)']});
                            var body = imapConnection.seq.fetch("1:*"  , {bodies: "" , struct: true });
                            head.on('message', function (msg, seqno) {
                                msg.on('body', function (stream, info) {
                                    var buffer = '';
                                    stream.on('data', function (chunk) {
                                        buffer += chunk.toString('utf8');
                                    });
                                    stream.once('end', function () {
                                        let h = (Imap.parseHeader(buffer));
                                        msg.once('attributes', function (attrs) {
                                            var headers = {
                                                mailFrom : h && h.from && h.from.length ?  h.from[0] : '',
                                                receivedTime : h && h.date && h.date.length ?  h.date[0] : '',
                                                subject: h &&  h.subject && h.subject.length ?  (h.subject[0]).replace(/\n/g , '').trim() : '',
                                                uid : attrs.uid,
                                                to:  h && h.to && h.to.length ?  h.to[0] : '',
                                                cc:  h && h.cc && h.cc.length ? h.cc: '' ,
                                                bcc: h && h.bcc && h.bcc.length ? h.bcc : '',
                                                allTo :  h && h.to && h.to.length ? h.to: '' 
                                            }

                                            // for agent folder only 
                                            var receivedTime = new Date(Util.modifyTime(headers.receivedTime )).getTime();
                                            var time =  new Date(new Date().setHours(0,0,0,0)).getTime();

					    resData.push(headers);
                                          // if( time > receivedTime ){
                                            //   resData.push(headers);
                                          //}else{
                                            //console.log( headers.receivedTime )
                                          // }
                                            
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
                                            var index = _.findIndex(resData , {uid : attrs.uid});
                                            var index1 = bodyHtml.indexOf('<div ');
                                            bodyHtml = bodyHtml.substring(index1 , bodyHtml.length);
                                            bodyHtml = bodyHtml.replace(/=C2=A0/g , '\r\n');
                                            bodyHtml = bodyHtml.replace(/=\r\n/g , '');
                                            bodyHtml = bodyHtml.split('\r\n\r\n--')[0];
                                            resData[index] && resData[index].subject ? resData[index].body = bodyHtml : '';
                                        });
                                    });
                                });
                            });
       
                            body.once('end', function () {
                               Util.writeLogs("End get emails from "+groupName)
                                cbkGetEmail(resData);
                            });
                        } catch (errorWhileFetching) {
                            Util.writeLogs("Error for getting emails from "+groupName+" : "+ errorWhileFetching)
                            cbkGetEmail(resData);
                        }
                     }
              });
            }else{
                cbkGetEmail(resData);
            }
        });
    }catch(boxOpenErr){
        Util.writeLogs("Error for getting emails from "+groupName+" : "+ boxOpenErr)
        cbkGetEmail(resData);
    }
}

exports.mailToAnotherFolder =   (  imapConnection , uid , boxName , moveFolderName ,callback ) => {
    try{
        imapConnection.openBox( boxName , function(err , box){
            if (err) {
                Util.writeLogs( "Email Move error :" + err.message );
                console.log(err );
                callback(err , null );
            }else{

                console.log( uid,boxName, moveFolderName )
                imapConnection.move(uid, moveFolderName , function(err3, code) {

                    if (err3) {
                        Util.writeLogs( "Email Move error :" + err3.message );
                        console.log(err3 );
                        callback(err3 , null );
                    } else  {
                        Util.writeLogs( "Mail moved to "+moveFolderName+" folder");

                        callback(null , code );
                    } 
                });
            }
        });
    }catch(boxOpenErr){
        Util.writeLogs("Email Move error :" + boxOpenErr )
        console.log(boxOpenErr );
        callback(boxOpenErr , null );
    }
}

exports.getUID =   ( imapConnection , email , callback ) => {
    var uid = null;
    try{
        imapConnection.openBox( email.groupName+"/"+email.groupName+" - "+email.agentName, function(err , box){
            if (err) {
                Util.writeLogs( "Get UID err:" + err.message );
                callback(err , uid );
            }else{
                testEmailsFetch( imapConnection, email, uid , function(err, result){
                    uid = result;
                    callback(err , result );
                })
            }
        });
    }catch(boxOpenErr){
        Util.writeLogs( "Get UID err:" + boxOpenErr );
        callback( boxOpenErr , null );
    }
}


