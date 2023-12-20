exports.getActivityId =  function (app, callback) {
    var activityId = '';
    app.db.query(
      `SELECT * FROM tickets WHERE name='activityId'`,
      (err, ticket) => {
        activityId = ticket.recordset[0].seq;
        app.db.query(
          `UPDATE tickets SET seq=${
            ticket.recordset[0].seq + 1
          } WHERE name='activityId'`,
          (err1, updated) => {
            callback(activityId);
          }
        );
      }
    );
  }
  
  exports.getCaseId = function (app, callback) {
      
    var caseId = '';
  
    app.db.query(`SELECT * FROM tickets WHERE name='caseId'`, (err, ticket) => {
      caseId = 'ITHD-' + ticket.recordset[0].seq;
      app.db.query(
        `UPDATE tickets SET seq=${
          ticket.recordset[0].seq + 1
        } WHERE name ='caseId'`,
        (err1, updated) => {
          callback(caseId);
        }
      );
    });
  }