import Promise from 'bluebird';
import readline from 'readline';
import { Writable } from 'stream';

const credentials = function() {
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
      const consoleInterface = readline.createInterface({
        input: process.stdin,
        output: mutedStdout,
        terminal: true
      });
  
      return new Promise(resolve => {
        consoleInterface.question('username: ', resolve);
      })
        .then(username => {
          credentialCache.username = username;
        })
        .then(() => new Promise(resolve => {
          consoleInterface.question('password: ', resolve);
          mute = true;
        }))
        .then(password => {
          credentialCache.password = password;
          mute = false;
          consoleInterface.write('\n');
          return credentialCache;
        })
        .finally(() => {
          consoleInterface.close();
        });
    }
    
    return Promise.resolve(credentialCache);
  };
}();

export default credentials;
