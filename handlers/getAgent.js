const async = require('async');
const moment = require('moment');

exports.getAgent = function ( app, email , callback ){
    if(email.agentId){
        app.db.query(`SELECT * FROM agent WHERE id=${email.agentId}` , (err , agentResult) =>{
            var agent1 = agentResult && agentResult.recordset && agentResult.recordset.length ? agentResult.recordset : []; 
            if(agent1 && agent1.length){
                if( agent1[0].isOnline || agent1[0].isBreak ){
                    agent1[0].name = agent1[0].name.trim();
                    callback(agent1[0]);
                }else{
                    agent(app , email ,false, function(agentRes){
                        callback(agentRes);
                    });
                }
            }else{
                agent(app , email , false ,  function(agentRes){
                    callback(agentRes);
                });
            }
        });
    }else{
        agent(app , email , false ,  function(agentRes){
            callback(agentRes);
        });
    }
}

exports.getAnotherAgent = function ( app, email , callback ){
    agent(app , email , true , function(agentRes){
        callback(agentRes);
    });
}

function agent (app , email , isAnotherAgent , callback ){
    var resData = {};
    app.db.query(`SELECT * FROM groups WHERE id=${email.groupId}` , (err1 ,groupResult ) =>{
        if(err1){
            console.log("err :" , err1 );
            callback(resData);
        }else{
            var date = new Date();
            date.setHours(0,0,0,0);
            date = moment(date).format("YYYY-MM-DDTHH:mm:ss") + '.000Z';
            console.log( date ,"date");

            
            var groups = groupResult && groupResult.recordset && groupResult.recordset.length ? groupResult.recordset : []; 
            var agentIds = JSON.parse(groups[0].agentIds);
            var whereQuery =  isAnotherAgent ? 
                                `agent.id IN (${agentIds.join()}) AND agent.isOnline=1 AND agent.id NOT IN (${email.agentId})`:
                                `agent.id IN (${agentIds.join()}) AND agent.isOnline=1`;
            app.db.query(`
                SELECT 
                    agent.id,
                    agent.email,
                    agent.name,
                    SUM(CASE WHEN emails.forwardTime  >= '${date}' AND emails.replyTime IS NULL THEN 1 ELSE 0 END) as pending , 
                    SUM(CASE WHEN emails.forwardTime  >= '${date}' AND emails.replyTime IS NOT NULL THEN 1 ELSE 0 END) as completed 
                FROM 
                    (agent LEFT JOIN emails ON agent.id = emails.agentId)
                WHERE 
                    ${ whereQuery } 
                    --AND emails.forwardTime >= '${date}'
                GROUP BY 
                    agent.id,agent.email,agent.name
                HAVING 
                    (SUM(CASE WHEN emails.forwardTime IS NOT NULL AND emails.replyTime IS NULL THEN 1 ELSE 0 END) < ${Number(process.env.MAX_NUMBER_OF_EMAILS)} )
                ORDER BY 
                    pending , completed`
                ,(err2 , agentResult1) =>{
                    console.log(err2 , agentResult1)
                     console.log(`SELECT 
                    agent.id,
                    agent.email,
                    agent.name,
                    SUM(CASE WHEN emails.forwardTime  >= '${date}' AND emails.replyTime IS NULL THEN 1 ELSE 0 END) as pending , 
                    SUM(CASE WHEN emails.forwardTime  >= '${date}' AND emails.replyTime IS NOT NULL THEN 1 ELSE 0 END) as completed 
                FROM 
                    (agent LEFT JOIN emails ON agent.id = emails.agentId)
                WHERE 
                    ${ whereQuery } 
                    --AND emails.forwardTime >= '${date}'
                GROUP BY 
                    agent.id,agent.email,agent.name
                HAVING 
                    (SUM(CASE WHEN emails.forwardTime IS NOT NULL AND emails.replyTime IS NULL THEN 1 ELSE 0 END) < ${Number(process.env.MAX_NUMBER_OF_EMAILS)} )
                ORDER BY 
                    pending , completed`)
                    if(err2){
                        console.log("err :" , err2 );
                        callback(resData);
                    }else if (agentResult1 && agentResult1.recordset && agentResult1.recordset.length ){
                        resData = agentResult1.recordset[0];
                        resData.name = resData.name.trim();
                        callback(resData);
                    }else{
                        callback(resData);
                    }
            });
        }
    });
}