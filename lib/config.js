import readAllUp from 'read-all-up';
import ini from 'ini';

try {
  var [ result ] = readAllUp.sync('.toggl-to-jirarc', {
    encoding: 'utf8'
  });
  var config = ini.parse(result.fileContents);
}
catch(error) {
  console.log(error);
}

export default config;
