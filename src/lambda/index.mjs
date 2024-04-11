import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";

const ec2Client = new EC2Client({ region: process.env.AWS_REGION });
const dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event, context) => {
  try {
    // Validate required environment variables
    const requiredEnvVars = [
      'AWS_REGION',
      'DYNAMODB_TABLE_NAME',
      'S3_SOURCE_BUCKET_URI',
      'EC2_IMAGE_ID',
      'EC2_INSTANCE_TYPE',
      'EC2_MIN_COUNT',
      'EC2_MAX_COUNT',
      'EC2_KEY_NAME',
      'EC2_INSTANCE_PROFILE_NAME',
      'EC2_SECURITY_GROUP_ID',
      'EC2_SUBNET_ID',
      'EC2_SHUTDOWN_BEHAVIOR'
    ];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    const tableName = process.env.DYNAMODB_TABLE_NAME;
    const scanResponse = await dynamodbClient.send(new ScanCommand({ TableName: tableName }));
    const items = scanResponse.Items;

    if (!items || items.length === 0) {
      console.log('No items found in DynamoDB table.');
      return { statusCode: 404, body: 'No items found in DynamoDB table.' };
    }

    const defaultTimestamp = new Date(0).toISOString();
    const mostRecentItem = items.sort((a, b) => {
      const timeA = a.timestamp || defaultTimestamp;
      const timeB = b.timestamp || defaultTimestamp;
      return new Date(timeB) - new Date(timeA);
    })[0];

    const item_id = mostRecentItem.id;
    const input_file_path = mostRecentItem.input_file_path || 'default_file_path';

    const commandScript = `#!/bin/bash
    echo "Node.js file executed"
    item_id="${item_id}"
    input_file_path="${input_file_path}"
    aws s3 cp s3://${process.env.S3_SOURCE_BUCKET_URI}/process_file.py /home/ec2-user/process_file.py
    chmod +x /home/ec2-user/process_file.py
    sudo yum install python3-pip -y
    python3 -m venv /home/ec2-user/env
    source /home/ec2-user/env/bin/activate
    pip install boto3
    python3 /home/ec2-user/process_file.py --region ${process.env.AWS_REGION} --item-id ${item_id} --input_file_path ${input_file_path} --output_file_path ${input_file_path}
    echo "Script completed successfully"`.replace('${item_id}', item_id)
      .replace('${input_file_path}', input_file_path);
    const commandScriptEncoded = Buffer.from(commandScript).toString('base64');

    const instanceConfig = {
      ImageId: process.env.EC2_IMAGE_ID,
      InstanceType: process.env.EC2_INSTANCE_TYPE,
      MinCount: process.env.EC2_MIN_COUNT,
      MaxCount: process.env.EC2_MAX_COUNT,
      KeyName: process.env.EC2_KEY_NAME,
      UserData: commandScriptEncoded,
      IamInstanceProfile: { Name: process.env.EC2_INSTANCE_PROFILE_NAME },
      SecurityGroupIds: [process.env.EC2_SECURITY_GROUP_ID],
      SubnetId: process.env.EC2_SUBNET_ID,
      InstanceInitiatedShutdownBehavior: process.env.EC2_SHUTDOWN_BEHAVIOR
    };

    const response = await ec2Client.send(new RunInstancesCommand(instanceConfig));
    const instanceId = response.Instances[0].InstanceId;
    console.log(`Launched EC2 instance with ID: ${instanceId}`);

    return {
      statusCode: 200,
      body: `Launched EC2 instance with ID: ${instanceId}`
    };
  } catch (error) {
    console.error(`Error: ${error}`);
    return {
      statusCode: 500,
      body: `Error launching EC2 instance: ${error.message || error}`
    };
  }
};
