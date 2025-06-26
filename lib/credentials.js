import Promise from 'bluebird';
import readline from 'readline';
import { Writable } from 'stream';

const credentials = function() {
  const credentialCache = {};

  return async function() {
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
  
      try {
        const username = await new Promise(resolve => {
          consoleInterface.question('username: ', resolve);
        });
        credentialCache.username = username;

        const password = await new Promise(resolve => {
          consoleInterface.question('password: ', resolve);
          mute = true;
        });
        credentialCache.password = password;
        mute = false;
        consoleInterface.write('\n');
        return credentialCache;
      } finally {
        consoleInterface.close();
      }
    }
    
    return credentialCache;
  };
}();

export default credentials;
