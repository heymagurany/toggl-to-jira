var async = require('async');
var TogglClient = require('toggl-api');
var readline = require('readline');
var keychain = require('./keychain.js');

var _getAPIToken = function (callback) {
  var service = 'urn:toggl-to-timecard:toggl';

  keychain.getGenericPassword(service, function (err, found, account, apiToken) {
    if (err) {
      callback(err);
      return;
    }

    if (found) {
      callback(null, apiToken);
      return;
    }

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    async.series({
      apiToken: function (callback) {
        rl.question('Toggl API key: ', function(apiToken) {
          callback(null, apiToken);
        });
      },
      save: function (callback) {
        rl.question('save API key to keychain? (y/n) ', function (answer) {
          callback(null, 'y' === answer);
        });
      }
    },
    function (err, credentials) {
      rl.close();

      if (err) {
        callback(err);
        return;
      }

      if (credentials.save) {
        keychain.setGenericPassword(service, 'API Token', credentials.apiToken, function (err) {
          if (err) {
            callback(err);
            return;
          }

          callback(null, credentials.apiToken);
        });
      }
      else {
        callback(null, credentials.apiToken);
      }
    });
  });
};

exports.createClient = function (callback) {
  _getAPIToken(function (err, apiToken) {
    if (err) {
      callback(err);
      return;
    }

    var client = new TogglClient({
      apiToken: apiToken
    });

    callback(null, client);
  });
};

exports.getWorkspaceID = function (client, question, callback) {
  client.getWorkspaces(function (err, workspaces) {
    if (err) {
      callback(err);
      return;
    }

    var rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    var importToWorkspaceID = NaN;

    async.whilst(
      function () {
        return isNaN(importToWorkspaceID);
      },
      function (callback) {
        if (workspaces.length > 1) {
          var options = [];

          workspaces.forEach(function (workspace, i) {
            var optionNum = i + 1;

            options[optionNum] = workspace.id;
            rl.write(optionNum + ') ' + workspace.name + '\n');
          });

          rl.question(question + ' ', function(answer) {
            importToWorkspaceID = options[parseInt(answer)];

            if (isNaN(importToWorkspaceID)) {
              rl.write('Invalid selection\n');
            }

            callback(null);
          });
        }
        else if (workspaces.length > 0){
          importToWorkspaceID = workspaces[0].id;

          callback(null);
        }
        else {
          callback("No toggl workspaces found");
        }
      },
      function (err) {
        rl.close();

        callback(err, importToWorkspaceID);
      }
    );
  });
};
