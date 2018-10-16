'use strict';

const DOCKER_TASK_ARN = process.env.DOCKER_TASK_ARN;
const DOCKER_TASK_SUBNETS = process.env.DOCKER_TASK_SUBNETS;
const INPUT_BUCKET_NAME = process.env.BUCKET_NAME_2;
const OUTPUT_BUCKET_NAME = process.env.BUCKET_NAME;
const ECS_CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || 'default';
const OUTPUT_S3_PATH = OUTPUT_BUCKET_NAME;
const OUTPUT_S3_AWS_REGION = process.env.OUTPUT_S3_AWS_REGION || 'us-east-1';

// Docker ARN format - arn:aws:ecs:us-east-1:account-id:task-definition/taskName:version
const temp = DOCKER_TASK_ARN.split(':');
// extract the task definition name from the arn
const ECS_TASK_DEFINITION = `${temp[5].split('/')[1]}:${temp[6]}`;

const ecsApi = require('./ecs');

module.exports.handler = function handler (event, context, callback) {
  
  const bucket = event.Records[0].s3.bucket.name;
  const key = event.Records[0].s3.object.key;
  const eventName = event.Records[0].eventName;

  console.log(JSON.stringify(event));
  console.log(`A new video file '${key}' was uploaded to '${bucket}' for processing.`);

  // parse the file processing details
  // example video file: test_00-08.mp4
  const s3_video_url = `https://s3.amazonaws.com/${bucket}/${key}`;
  const thumbnail_file = key.substring(0, key.indexOf('_')) + '.png';
  const frame_pos = key.substring(key.indexOf('_')+1, key.indexOf('.')).replace('-',':');
  console.log(`Processing file '${s3_video_url}' to extract frame from position '${frame_pos}' to generate thumbnail '${thumbnail_file}'.`);

  // run the docker ecs task
  runThumbnailGenerateTask(s3_video_url, thumbnail_file, frame_pos);

  callback(null, {});
}

var runThumbnailGenerateTask = (s3_video_url, thumbnail_file, frame_pos) => {

  const docker_subnet_items = DOCKER_TASK_SUBNETS.split(',');

  // run an ECS Fargate task
  var params = {
    cluster: `${ECS_CLUSTER_NAME}`,
    launchType: 'FARGATE',
    taskDefinition: `${ECS_TASK_DEFINITION}`,
    count: 1,
    platformVersion:'LATEST',
    networkConfiguration: {
      awsvpcConfiguration: {
          subnets: [],
          assignPublicIp: 'ENABLED'
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: 'video-to-thumb-container',
          environment: [
            {
              name: 'INPUT_VIDEO_FILE_URL',
              value: `${s3_video_url}`
            },
            {
              name: 'OUTPUT_THUMBS_FILE_NAME',
              value: `${thumbnail_file}`
            },
            {
              name: 'POSITION_TIME_DURATION',
              value: `${frame_pos}`
            },
            {
              name: 'OUTPUT_S3_PATH',
              value: `${OUTPUT_S3_PATH}`
            },
            {
              name: 'AWS_REGION',
              value: `${OUTPUT_S3_AWS_REGION}`
            }
          ]
        }
      ]
    }
  };
  // assign the subnets
  params.networkConfiguration.awsvpcConfiguration.subnets = docker_subnet_items;

  // run the ecs task passing in the configuration
  ecsApi.runECSTask(params);
}