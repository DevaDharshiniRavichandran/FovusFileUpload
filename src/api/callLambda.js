// import { v4 as uuidv4 } from 'uuid';
import AWS from 'aws-sdk';
const { nanoid } = require('nanoid');

AWS.config.update({ region: 'us-east-2' });

const lambda = new AWS.Lambda();

// // Getting the current timestamp
// const getCurrentTimestamp = () => {
//   return new Date().toISOString();
// };

const getCurrentTimestamp = () => {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    const localTime = new Date(now.getTime() - timezoneOffset);
    return localTime.toISOString().slice(0, -1);
};
  
  console.log(getCurrentTimestamp()); // This will give you the current time in your local timezone
  

// Invocating lambda function parameters
export const callLambda = async (bucketname, fileName, inputText) => {
    const params = {
        FunctionName: 'saveToDynamoDB',
        InvocationType: 'RequestResponse', 
        LogType: 'None',
        Payload: JSON.stringify({
            id: nanoid(),
            // uuidv4(),
            input_text: inputText,
            input_file_path: `s3://${bucketname}/${fileName}`,
            timestamp: getCurrentTimestamp()
        }),
    };

    // Invoking the Lambda function
    lambda.invoke(params, (err, data) => {
        if (err) {
            console.log(err, err.stack);
        } else {
            console.log('Lambda function invoked successfully');
            console.log(data);
        }
    });
};
