module.exports = function parseRequest(req, cb) {
  var requestLine = [req.method.toUpperCase(), req.url, 'HTTP/' + req.httpVersion + '\r\n'].join(' ');
  Object.keys(req.headers).forEach(function(header) {
    requestLine += header + ': ' + req.headers[header] + '\r\n';
  });

  var buf = '';
  req.on('data', function(data) {
    buf += data.toString();
  });

  req.on('end', function() {
    if(buf.length) {
      requestLine += '\r\n';
      requestLine += buf;
      requestLine += '\r\n\r\n';
    } else {
      requestLine += '\r\n\r\n';
    }
    cb(null, requestLine); 
  });

  req.on('error', function(err) {
    cb(err);
  });
}

