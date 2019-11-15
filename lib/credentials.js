const Promise = require('bluebird');
const readline = require('readline');
const Writable = require('stream').Writable;

module.exports = function() {
  const credentialCache = {};

  return function() {
    if (!credentialCache.username || !credentialCache.password) {
      var mute = false;
      const mutedStdout = new Writable({
        write(chunk, encoding, callback) {
          if (!mute) {
            process.stdout.write(chunk, encoding);
          }
          callback();
        }
      });
      const interface = readline.createInterface({
        input: process.stdin,
        output: mutedStdout,
        terminal: true
      });
  
      return new Promise(resolve => {
        interface.question('username: ', resolve);
      })
        .then(username => {
          credentialCache.username = username;
        })
        .then(() => new Promise(resolve => {
          interface.question('password: ', resolve);
          mute = true;
        }))
        .then(password => {
          credentialCache.password = password;
          mute = false;
          interface.write('\n');
          return credentialCache;
        })
        .finally(() => {
          interface.close();
        });
    }
    
    return Promise.resolve(credentialCache);
  };
}();
