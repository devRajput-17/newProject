var nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');
var Imap = require('imap'),
inspect = require('util').inspect;
const moment = require('moment')

var imapConfig = {
    user: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    host : process.env.EMAIL_HOST,
    port: 993,
    tls: true,
    tlsOptions : { rejectUnauthorized : false }
}

exports.sendMail = function (mailOptions , callBack) {

    // var smtpTransport = nodemailer.createTransport({
    
    //     host: "exchange.aramco.com.sa", // hostname
    //     port: 25, // port for secure SMTP
    //     secure: false,// use TLS
    // 	tls: {
    //     	rejectUnauthorized: false
    // 	},
    //     auth: {
    //         user: process.env.EMAIL_USERNAME,
    //         pass: process.env.EMAIL_PASSWORD
    //     }
    // });

    let smtpTransport = nodemailer.createTransport({                 
        
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });
    
   
    smtpTransport.sendMail(mailOptions, function(error, response){
        if(error){
            console.log("EMail Send Error : " , error );
            callBack(error)
        }else{
            callBack(response);
        }
    });
}

exports.writeLogs = function(logs){
    Logs(logs)
}

function Logs(logs){
    let today = moment().utc().format("YYYY-MM-DD")+'-Email Stuck.log'
    var log = moment().format("DD-MM-YYYY HH:mm") + ' - ' + logs;
    console.log(log);
    fs.readdir(path.join(__dirname,'/logs'), function (err, items) {
        if (items && items.length) {
            if( items.indexOf(today) >= 0 ){
                let logger = fs.createWriteStream(path.join(__dirname, '/logs/'+today ), {
                    flags: 'a', 
                });
                logger.write(log + '\n');
                logger.end();
            }else{
                let logger = fs.createWriteStream(
                    path.join(__dirname,'/logs/'+today)
                );
                logger.write(log + '\n'); 
                logger.end();
            }
        }else{
            let logger = fs.createWriteStream(
                path.join(__dirname,'/logs/'+today)
            );
            logger.write(log + '\n');
            logger.end();
        }
    });
}

exports.checkAction = function( app , action ){
    return new Promise((resolve,reject)=>{
        app.db.query(`SELECT ${action} FROM action` , (err , result) =>{
            if(err){
                console.log("Action Error :" , err )
                reject(err)
            }
            resolve(result.recordset[0][action])
        })
    })
}

exports.updateAction = function( app , action , value ){
    return new Promise((resolve,reject)=>{
        app.db.query(`UPDATE action SET ${action}='${value}'` , (err , result) =>{
            if(err){
                console.log("Action Update Error :" , err )
                reject(err)
            }
            resolve(result)
        })
    })
}

exports.createSkillGroupRoutingImapConnection = function(){
    Logs("Create Skill Group Routing Connection")
    return new Promise((resolve,reject)=>{
        var skillGroupEmailImap = new Imap(imapConfig);
        skillGroupEmailImap.once('ready', function () {
            Logs('Skill Group Imap connected');
            global.skillGroupEmailImapConnection = skillGroupEmailImap
            resolve(skillGroupEmailImap)
        });
        skillGroupEmailImap.once('error', function(err) {
            Logs("Skill Group Imap Error : "+ err.message);
            global.skillGroupEmailImapConnection = skillGroupEmailImap
            resolve(skillGroupEmailImap)
        });
        skillGroupEmailImap.connect();
    })
}

exports.createAgentFolderRoutingImapConnection = function(){
    Logs("Create Agent Folder Routing Connection")
    return new Promise((resolve,reject)=>{
        var agentFolderEmailImap = new Imap(imapConfig);
        agentFolderEmailImap.once('ready', function () {
            Logs('Agent Folder Imap connected');
            global.agentFolderEmailImapConnection = agentFolderEmailImap
            resolve(agentFolderEmailImap)
        });
        agentFolderEmailImap.once('error', function(err) {
            Logs("Agent Folder Imap Error : "+ err.message);
            global.agentFolderEmailImapConnection = agentFolderEmailImap
            resolve(agentFolderEmailImap)
        });
        agentFolderEmailImap.connect();
    })
}

exports.createSentItemsRoutingImapConnection = function(){
    Logs("Create Sent Items Routing Connection")
    return new Promise((resolve,reject)=>{
        var sentItemsEmailImap = new Imap(imapConfig);
        sentItemsEmailImap.once('ready', function () {
            Logs('Sent Items Imap connected');
            global.sentItemsEmailImapConnection = sentItemsEmailImap
            resolve(sentItemsEmailImap)
        });
        sentItemsEmailImap.once('error', function(err) {
            Logs("Sent Items Imap Error : "+ err.message);
            global.sentItemsEmailImapConnection = sentItemsEmailImap
            resolve(sentItemsEmailImap)
        });
        sentItemsEmailImap.connect();
    })
}

exports.modifySubject = function(subject){

    //console.log( subject , "subjectsubjectsubjectsubjectsubjectsubjectsubject")

    subject = subject.includes('[EXTERNAL]') ? subject.replace('[EXTERNAL]','') : subject.includes('[External]') ? subject.replace('[External]','') : subject.includes('[external]') ? subject.replace('[external]','') : subject ;
    
    subject = subject.includes('R:') ? subject.replace('R:','') : subject ;

    subject = subject.includes('F:') ? subject.replace('F:','') : subject ;

    subject = subject.includes('r:') ? subject.replace('r:','') : subject ;

    subject = subject.includes('f:') ? subject.replace('f:','') : subject ;

    subject = subject.trim();

//    console.log( subject , "subjectsubjectsubjectsubjectsubjectsubjectsubject")


    if(subject.includes('RE: ')){
        return subject.replace('RE: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('Re: ')){
        return subject.replace('Re: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('re: ')){
        return subject.replace('re: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('RE:')){
        return subject.replace('RE:', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('Re:')){
        return subject.replace('Re:', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('re:')){
        return subject.replace('re:', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('RE ')){
        return subject.replace('RE ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('Re ')){
        return subject.replace('Re ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('re ')){
        return subject.replace('re ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('FWD: ')){
        return subject.replace('FWD: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('Fwd: ')){
        return subject.replace('Fwd: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('fwd: ')){
        return subject.replace('fwd: ', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('FWD:')){
        return subject.replace('FWD:', '').trim().replace(/'/g, '"') 

    }else if(subject.includes('Fwd:')){
        return subject.replace('Fwd:', '').trim().replace(/'/g, '"');

    }else if(subject.includes('fwd:')){
        return subject.replace('fwd:', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('FWD ')){
        return subject.replace('FWD ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('Fwd ')){
        return subject.replace('Fwd ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('fwd ')){
        return subject.replace('fwd ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('FW: ')){
        return subject.replace('FW: ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('Fw: ')){
        return subject.replace('Fw: ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('fw: ')){
        return subject.replace('fw: ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('FW:')){
        return subject.replace('FW:', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('Fw:')){
        return subject.replace('Fw:', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('fw:')){
        return subject.replace('fw:', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('FW ')){
        return subject.replace('FW ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('Fw ')){
        return subject.replace('Fw ', '').trim().replace(/'/g, '"') ;

    }else if(subject.includes('fw ')){

        return subject.replace('fw ', '').trim().replace(/'/g, '"') ;
    }else{

        return subject.trim().replace(/'/g, '"');
    }

     
}

exports.modifyMailFrom = function(mailFrom){
    return mailFrom.includes('<') ? mailFrom.split('<')[1].split('>')[0] :mailFrom;
}

exports.modifyTime = function(date){
    return new Date(moment(date).add(process.env.TIME,'hours'))
}

exports.isMatched = function(firstData, secondData){
    const match =  firstData === secondData ? true : false ;
    return match;
}