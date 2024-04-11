#!/usr/bin/env python3
import boto3
import argparse
import os

# Parsing command-line arguments
parser = argparse.ArgumentParser(description='Process and update file information in AWS')
parser.add_argument('--region', required=True, help='AWS region (e.g., us-east-2)')
parser.add_argument('--item-id', required=True, help='Item ID to process')
parser.add_argument('--input_file_path', required=True, help='S3 input file path')
parser.add_argument('--output_file_path', required=True, help='S3 output file path')
args = parser.parse_args()

# AWS clients initialized
s3_client = boto3.client('s3', region_name=args.region)
dynamodb_client = boto3.client('dynamodb', region_name=args.region)

#Download a file from S3 to a local path
def download_from_s3(s3_uri, local_path):
    bucket, key = s3_uri.replace("s3://", "").split('/', 1)
    s3_client.download_file(bucket, key, local_path)
    print(f"Downloaded file from {s3_uri} to {local_path}")

#Upload a file from a local path to S3
def upload_to_s3(local_path, s3_uri):
    bucket, key = s3_uri.replace("s3://", "").split('/', 1)
    s3_client.upload_file(local_path, bucket, key)
    print(f"Uploaded file from {local_path} to {s3_uri}")

#Retrieve an item from DynamoDB by item ID
def get_item_from_dynamodb(table, item_id):
    response = dynamodb_client.get_item(TableName=table, Key={'id': {'S': item_id}})
    return response.get('Item')

#Update an item in DynamoDB with the output file path
def update_item_in_dynamodb(table, item_id, output_s3_uri):
    dynamodb_client.update_item(
        TableName=table,
        Key={'id': {'S': item_id}},
        UpdateExpression='SET output_file_path = :val1',
        ExpressionAttributeValues={':val1': {'S': output_s3_uri}}
    )
    print(f"DynamoDB updated for item ID {item_id} with output file path {output_s3_uri}")

# Main processing function
def process_file(item_id, input_s3_uri, output_s3_uri):
    local_input_path = '/tmp/' + os.path.basename(input_s3_uri)
    local_output_path = '/tmp/output_' + os.path.basename(input_s3_uri)

    # Downloading the input file from S3
    download_from_s3(input_s3_uri, local_input_path)

    # Retrieving item information from DynamoDB
    item = get_item_from_dynamodb('FileTable', item_id)
    if not item:
        raise ValueError(f"Item with ID {item_id} not found in DynamoDB")

    # Appending text from DynamoDB item to the file
    input_text = item.get('input_text', {}).get('S', '')
    with open(local_input_path, 'r+') as file:
        content = file.read()
        if input_text not in content:
            file.write(input_text)

    # Copy local input file to output file path
    os.rename(local_input_path, local_output_path)

    # Upload the processed file back to S3
    upload_to_s3(local_output_path, output_s3_uri)

    # Update DynamoDB with the new output file path
    update_item_in_dynamodb('FileTable', item_id, output_s3_uri)

    print(f"File processed and uploaded to {output_s3_uri}")

# Executing the processing function with provided command-line arguments
process_file(args.item_id, args.input_file_path, args.output_file_path)
