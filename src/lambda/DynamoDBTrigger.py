import boto3
import base64
import json
from datetime import datetime


# Initialize AWS clients with environment variables
ec2_client = boto3.client('ec2', region_name=os.environ['AWS_REGION'])
dynamodb = boto3.resource('dynamodb', region_name=os.environ['AWS_REGION'])

def lambda_handler(event, context):
    # Search the recently inserted record from the table
    table = dynamodb.Table(os.environ['DYNAMODB_TABLE'])
    response = table.scan()
    items = response['Items']
        
    # Using old date as default timestamp value
    default_timestamp = datetime.min.isoformat()
        
    # Sorting items based on timestamp  
    most_recent_item = sorted(
        items,
        key=lambda x: x.get('timestamp', default_timestamp),
        reverse=True
    )[0]

    item_id = most_recent_item['id']
    input_file_path = most_recent_item.get('input_file_path', 'default_file_path')
        
    # Creating the user data script that the EC2 instance will run on startup
    command_script = f"""#!/bin/bash
    echo "python file executed"

    # Defining variables inside the script
    item_id="{item_id}"
    input_file_path="{input_file_path}"
    
    # Exporting variables to be used in the following sub processes
    export item_id
    export input_file_path
    
    echo "Item id = ${{item_id}}"
    
    # Download the Python script from S3 bucket
        aws s3 cp s3://{os.environ['S3_BUCKET_NAME']}/process_file.py /home/ec2-user/process_file.py
        if [ $? -ne 0 ]; then
        echo "Failed to download the python file"
        exit 1
    fi
    
    chmod +x /home/ec2-user/process_file.py
    
    sudo yum install python3-pip -y
    if [ $? -ne 0 ]; then
        echo "Failed to install python3-pip"
        exit 1
    fi
    
    python3 -m venv /home/ec2-user/env
    source /home/ec2-user/env/bin/activate
    
    pip install boto3
    if [ $? -ne 0 ]; then
        echo "Failed to install boto3"
        exit 1
    fi

    
    sleep 60
    
    python3 /home/ec2-user/process_file.py --region {os.environ['AWS_REGION']} --item-id ${{item_id}} --input_file_path ${{input_file_path}} --output_file_path ${{input_file_path}}
    if [ $? -ne 0 ]; then
        echo "Failed to execute process_file.py"
        exit 1
    fi
    
    deactivate
    
    echo "Script completed successfully"
    echo "python file executed"
    """
        
    
    command_script_encoded = base64.b64encode(command_script.encode('utf-8')).decode('utf-8')
    
    # Define the instance configuration
    instance_config = {
        'ImageId': os.environ['EC2_AMI_ID'],
        'InstanceType': os.environ['EC2_INSTANCE_TYPE'],
        'MinCount': 1,
        'MaxCount': 1,
        'KeyName': os.environ['EC2_KEY_NAME'],
        'UserData': command_script_encoded,
        'IamInstanceProfile': {
            'Name': os.environ['IAM_INSTANCE_PROFILE_NAME']
        },
        'SecurityGroupIds': [
            os.environ['SECURITY_GROUP_ID']
        ],
        'SubnetId': os.environ['SUBNET_ID'],
        'InstanceInitiatedShutdownBehavior': 'terminate'
    }

    # Launch the EC2 instance
    response = ec2_client.run_instances(**instance_config)
    instance_id = response['Instances'][0]['InstanceId']
    logger.info(f'Launched EC2 instance with ID: {instance_id}')
    
    return {
        'statusCode': 200,
        'body': json.dumps(f'Launched EC2 instance with ID: {instance_id}')
    }
    
