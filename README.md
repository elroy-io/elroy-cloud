# Elroy Cloud

`npm install elroy-cloud`

## Example

```js
var Server = require('./cloud');

var s = new Server();
s.collector(function(data){
  console.log('log:',data.msg);
});

s.listen(process.env.PORT || 3000);
```
