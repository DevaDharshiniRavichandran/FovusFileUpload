// my-app/src/api/uploadToS3.js
import awsConfig from './aws-config';
import AWS from 'aws-sdk';

const s3 = new AWS.S3();

export const uploadToS3 = async (file, fileName) => {
  const params = {
    Bucket: 'my-fovusfile-bucket',
    Key: fileName,
    Body: file,
  };

  try {
    await s3.upload(params).promise();
    console.log('File uploaded to S3');
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw error;
  }
};