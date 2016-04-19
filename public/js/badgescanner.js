var gUM=false;
var db = null;
var lastvcard = null;

var initCanvas = function (w,h) {
  var gCanvas = document.getElementById("qr-canvas");
  gCanvas.style.width = w + "px";
  gCanvas.style.height = h + "px";
  gCanvas.width = w;
  gCanvas.height = h;
  var gCtx = gCanvas.getContext("2d");
  gCtx.clearRect(0, 0, w, h);
};

var success = function(stream) {
  var v=document.getElementById("v");
  v.src = window.URL.createObjectURL(stream);
  gUM=true;
};
	
var error = function(e) {
  gUM=false;
  return;
};

var captureToCanvas = function() {
  if (gUM) {
    try {
      document.getElementById("qr-canvas").getContext("2d").drawImage(v,0,0);
      qrcode.decode();
    } catch(e) {       
    };
  }
};

var simplify = function(x) {
  if (!x) {
    return null;
  }
  var y = [];
  for(var i in x) {
    if (x[i].value) {
      y.push(x[i].value);
    }
  }
  return y.join(",");
}


var createDatabase = function(callback) {
 db = new PouchDB("badgescanner");
 var ddoc = {
   _id: '_design/query',
   views: {
     byts: {
       map: function (doc) {
         if (typeof doc.ts != "number") {
           doc.ts = 0;
         }
         emit(doc.ts,null);      
       }.toString()
     }
   }
 };

 db.put(ddoc).then(function (data) {
   callback(null, data);
 }).catch(function (err) {
   callback(null, null);
 });
}


var renderTable = function() {
  var fn = function(doc) {
    if (typeof doc.ts == "number") {
      emit(doc.ts,null);      
    }
  };
  db.query("query/byts", {descending:true, include_docs:true} ).then(function (result) {
    if(result.rows.length>0) {
      var html = '<table class="primary">';
      html += '<thead><tr>';
      html += '<th>fn</th>';
      html += '<th>title</th>';
      html += '<th>org</th>';
      html += '<th>tel</th>';
      html += '<th>email</th>';
      html += '<th>adr</th>';
      html += '</tr></thead>';
      html += '<tbody>';
      for(var i in result.rows) {
        var d = result.rows[i].doc;
        if (d) {
          html += '<tr>';
          html += '<td>' + d.fn + '</td>';
          html += '<td>' + d.title + '</td>';
          html += '<td>' + d.org + '</td>';
          html += '<td>' + d.tel + '</td>';
          html += '<td>' + d.email + '</td>';
          html += '<td>' + d.adr + '</td>';
          html += '</tr>';
        }
      }    
      html += '</tbody></table>';
    } else {
      html = "";
    }
    document.getElementById("thetable").innerHTML=html;
    // handle result
  }).catch(function (err) {
    console.log("query error",err);
  });  
};


var replicate = function() {
  document.getElementById("replicationstatus").innerHTML="";
  var url = document.getElementById("url").value;
  if(url) {
    var remoteDB = new PouchDB(url);
    db.replicate.to(remoteDB)
      .on("change", function(info) { 
        document.getElementById("replicationstatus").innerHTML = "IN PROGRESS - " + info.docs_written; 
      })
      .on("complete", function(info) { 
        document.getElementById("replicationstatus").innerHTML = "COMPLETE - " + info.docs_written;
      })
      .on("error",  function(err) { 
        document.getElementById("replicationstatus").innerHTML = "ERROR - " + JSON.strinfify(err);
      });
  }
};

// called when a qrcode is detected
qrcode.callback = function(data) {
  console.log("!!",(new Date()).getTime());
  // create vcard object
  var vcard = vcardParse(data);
  vcard.tel = simplify(vcard.tel);
  vcard.email = simplify(vcard.email);
  vcard.adr = simplify(vcard.adr);
  var d = new Date();
  vcard.ts = d.getTime();
  vcard.date = d.toISOString();
  
  if (lastvcard && vcard.fn == lastvcard.fn) {
    console.log("rejected - we just had that one", vcard.fn);
    return;
  }
  
  console.log("accepted", vcard)
   
  // play audio
  var myAudio = document.getElementById("beep"); 
  myAudio.play();
   
  // keep last vcard to debounce
  lastvcard = vcard;
  
  // saved to database
  db.post(vcard).then(function (response) {
    
    // update UI
    renderTable();
    
  }).catch(function (err) {
    console.log(err);
  });
};

// delete all data
var deleteData = function() {
  db.destroy().then(function (response) {
    createDatabase(function() {
      renderTable();
    })
  });
}

window.addEventListener("DOMContentLoaded", function() {

  // create database and design docs
  createDatabase(function() { 
    
    // clear canvas
    initCanvas(500,500);

    if (navigator.getUserMedia) {
      navigator.getUserMedia({video: true, audio: false}, success, error);
    } else if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({video: { facingMode: "environment"} , audio: false})
          .then(success)
          .catch(error);
    } else if (navigator.webkitGetUserMedia) {
      navigator.webkitGetUserMedia({video:true, audio: false}, success, error);
    } else if (navigator.mozGetUserMedia) {
      navigator.mozGetUserMedia({video: true, audio: false}, success, error);
    }
    setInterval(captureToCanvas, 500);

    renderTable();
  });

});