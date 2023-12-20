var CronJob = require('cron').CronJob;
var request = require('request');

var emails = [];
  

function cronFunction (){

    // var skillGroupRouting = new CronJob( '0 */'+process.env.SKILL_GROUP_ROUTING +' * * * *' , function() {
    //     request('http://localhost:3043/stuck/emails/skillGroup');
    // }, null, true);
    // skillGroupRouting.start();

    //  var agentFolderRouting = new CronJob( '0 */'+process.env.AGENT_FOLDER_ROUTING +' * * * *' , function() {
    //     // request('http://localhost:3043/stuck/emails/agentFolder');
    //     var jsonDataObj = {'groupId': 2 , 'agentId': 31, 'emails': emails};
    //     request.post(
    //         {
    //             url: 'http://localhost:3043/stuck/emails/agentFolder',
    //             body: jsonDataObj,
    //             json: true
    //         }, function(error, response, body){
    //             console.log(body);
    //         }
    //     );
    // }, null, true);
    // agentFolderRouting.start();

 
    // var sentItemsRouting = new CronJob('0 */'+process.env.SENT_ITEM_ROUTING +' * * * *' , function() {
    // // var sentItemsRouting = new CronJob('0 */1 * * * * ' , function() {
    //     request('http://localhost:3043/stuck/emails/sentItems');
    // }, null, true);
    // sentItemsRouting.start();

    var moveToCompleteRouting = new CronJob( '0 */1 * * * *' , function() {
        request('http://localhost:3043/stuck/emails/moveToComplete');
    }, null, true);
    moveToCompleteRouting.start();



	

}

module.exports = cronFunction;