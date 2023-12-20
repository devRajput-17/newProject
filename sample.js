
var Imap = require('imap'),
    inspect = require('util').inspect;
 
var imap = new Imap({
  user: 'ithelpdesk@aramco.com',
  password: 'Dd23nCsoLWnf5DBtyCyedUGjYexg2bVF',
  host: 'www2.aramco.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false }
});
 
function openInbox(cb) {
  //imap.openBox('IT/IT - Alsuwaigh, Mohannad A', true, cb);
  //imap.openBox('IT', true, cb);

}
imap.once('ready',function(){
  openInbox(function(err, box) {
    /*imap.move(225947, 'New Emails' , function(err, code) {
        if(err){
            console.log('error in moving', err);
        }else{
            console.log('mail moved to folder', code );
        }
    })*/
  })
}) ;

imap.once('ready', function() {
  console.log("IMAP connected")
  openInbox(function(err, box) {
    if (err) throw err;
    var f = imap.seq.fetch('1:*', {
      bodies: 'HEADER',
      struct: true
    });
    f.on('message', function(msg, seqno) {
      console.log('Message #%d', seqno);
      var prefix = '(#' + seqno + ') ';
      msg.on('body', function(stream, info) {
        var buffer = '';
        stream.on('data', function(chunk) {
          buffer += chunk.toString('utf8');
        });
        stream.once('end', function() {
          //console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
		 let h = (Imap.parseHeader(buffer));
        //console.log(h.subject, h['message-id'],  h['in-reply-to'], h.references)
console.log(h.subject, h['message-id'])
			checkReplyEmail( h['message-id'][0], function( replied){

                                              console.log( replied , "replied")
                                           })
        });
      });
      msg.once('attributes', function(attrs) {
        //console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
               //console.log(attrs.uid, "attrs.uid")
 
      if(0){
                 imap.move(attrs.uid, 'IT' , function(err, code) {
        if(err){
            console.log('error in moving', err);
        }else{
            console.log('mail moved to folder', code );
        }
    })
}
      });
      msg.once('end', function() {
        //console.log(prefix + 'Finished');
      });
    });
    f.once('error', function(err) {
      //console.log('Fetch error: ' + err);
    });
    f.once('end', function() {
      console.log('Done fetching all messages!');
      imap.end();
    });
  });
});
 
imap.once('error', function(err) {
  console.log(err ,"IMAP  ERROR");
});
 
imap.once('end', function() {
  console.log('Connection ended');
});

function checkReplyEmail(mid,callback){

    imap.openBox('Sent Items', true, function(err, box) {
           console.log(mid, "mid")
        imap.search( [['HEADER','IN-REPLY-TO', mid ]] ,function(err2, results2) {
                    
            console.log(err2, results2)
            if(results2 && results2.length){
                callback( true)
            }else{
                callback( false)
            }

        })
    })
//})

}
imap.once('ready', function() {
 var arr = ["<6b6e00cfafbb42b581383765d1b64789@aramco.com>",
"<CANBX8DcdKLF8=U=BhNPMhqKb9FP+nz-XDcVVj0C4t_pKzPO2GA@mail.gmail.com>", 
"<CADWXhgQLV0XDS4Cxe_aawYOTVMYi+9o6kj9MHQfzN4EENnhYiw@mail.gmail.com>",
"<CAMbiWFFY3No=QkdGEtJD0P-WAFxTiydqm3maKjzVU6HEw9MXDw@mail.gmail.com>",
"<21c201d88955$fe32b0b0$fa981210$@eramgroup.com>",
"<5fa2eb9d0516480280ac983a1770d184@aramco.com>", 
"<a81540f09d74402e84836c2833b62c1a@aramco.com>",
"<c9d8047ce46445d395e28361d75c0aea@aramco.com>",
"<748f7fef6fa84e4aa05d574b7e804f40@aramco.com>",
"<1be54313ba4741568aea92ac54931559@aramco.com>",
"<129B7386-BB5B-47F3-9EA8-F8FC72DF5670@ARAMCO.COM>",
"<6633AE15-BEED-4E27-97D1-C77C0F03E3DA@ARAMCO.COM>",
"<0a2f6ff957954f5398091869c635b167@aramco.com>",
"<98a39df8b91741b5b2ab4d78a2168379@aramco.com>",
"<fbd16624c6e847aaa9e695b83b652f13@aramco.com>",
"<671493bee89c4454ae93e7910ea80a53@aramco.com>",
"<d2a1f18aa05b4d0da3422f7d64c0d1be@aramco.com>",
"<96cb10098e23415b918072484a1ea743@aramco.com>",
"<9007154aec5a425d901dc241e9d25e7e@aramco.com>",
"<c56fe66ca1974b0a9fdad71a21a94152@aramco.com>",
"<cd8d0c58b7b541cab17aaffdea740db1@aramco.com>",
"<c7202dd8020a41069087a3f3a6b5171b@aramco.com>",
"<0d73c6b40edc41d2b479fee32e7a0e8d@aramco.com>",
"<C996C32B-2704-45B9-A38B-F7A7D99DB039@aramco.com>"]
 for(var i=0; i< arr.length; i++){
checkReplyEmail(arr[i], function(){})
}
})
 
// imap.once('ready', function() {
//   openInbox(function(err, box) {
//     if (err) throw err;
//     var f = imap.seq.fetch(box.messages.total + ':*', { bodies: ['HEADER.FIELDS (FROM)','TEXT'] });
//     f.on('message', function(msg, seqno) {
//       console.log('Message #%d', seqno);
//       var prefix = '(#' + seqno + ') ';
//       msg.on('body', function(stream, info) {
//         if (info.which === 'TEXT')
//           console.log(prefix + 'Body [%s] found, %d total bytes', inspect(info.which), info.size);
//         var buffer = '', count = 0;
//         stream.on('data', function(chunk) {
//           count += chunk.length;
//           buffer += chunk.toString('utf8');
//           if (info.which === 'TEXT')
//             console.log(prefix + 'Body [%s] (%d/%d)', inspect(info.which), count, info.size);
//         });
//         stream.once('end', function() {
//           if (info.which !== 'TEXT')
//             console.log(prefix + 'Parsed header: %s', inspect(Imap.parseHeader(buffer)));
//           else
//             console.log(prefix + 'Body [%s] Finished', inspect(info.which));
//         });
//       });
//       msg.once('attributes', function(attrs) {
//         console.log(prefix + 'Attributes: %s', inspect(attrs, false, 8));
//       });
//       msg.once('end', function() {
//         console.log(prefix + 'Finished');
//       });
//     });
//     f.once('error', function(err) {
//       console.log('Fetch error: ' + err);
//     });
//     f.once('end', function() {
//       console.log('Done fetching all messages!');
//       imap.end();
//     });
//   });
// });

imap.connect();




