'use strict';

module.exports.handler = function handler (event, context, callback) {
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;

  console.log(JSON.stringify(event));
  console.log(`A new thumbnail file was generated at 'https://s3.amazonaws.com/${bucket}/${key}'.`);

  callback(null);
}
