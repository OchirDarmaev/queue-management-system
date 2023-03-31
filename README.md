# Queue management system. Serverless

The electronic queue system allows you to automate the management of client flows

## Context

The admin manages the system.
The service has a name and a description.
The service point has a serial number.
A service point may provide multiple services.
The specialist works at the service point.
The specialist provides the necessary service to the client
The queue may take precedence. example: Paid and free

## Flow

The client comes.
The client opens the site "www.queue.example".
He chooses the service he needs.
The system puts him in line
He gets a number in line.
He sees the monitor and waits for his turn.
When the service point is ready to serve the next client, the system calls next client to a service point.
When it's his turn, he sees the name of the service point he needs to go to.
He comes to the service center.
The specialist serves the client.
The client receives the service.
Specialist customer service.
The client leaves.
Specialist serving the next client

## External clients

### Administrator

It manages the service points.
It manages lists of services.
It assigns a service to a service point.

### Point of service

It shows the name of the service point.
Shows status - active/inactive

### Specialist

It activates/deactivates the service point.
It marks the client as served/not shown.

### Monitor in the hall

Shows information about the queue.
It shows which point of service the customer needs to contact.

### Customer who needs a service

He chooses the service he needs and puts the number in the queue.
It gets information about the queue "How many people are in the queue"

## Usage

### Deployment

In order to deploy the example, you need to run the following command:

```bash
serverless deploy
```

After running deploy, you should see output similar to:

```bash
Deploying aws-node-project to stage dev (us-east-1)

✔ Service deployed to stack aws-node-project-dev (112s)

functions:
  hello: aws-node-project-dev-hello (1.5 kB)
```

### Invocation

After successful deployment, you can invoke the deployed function by using the following command:

```bash
serverless invoke --function hello
```

Which should result in response similar to the following:

```json
{
  "statusCode": 200,
  "body": "{\n  \"message\": \"Go Serverless v3.0! Your function executed successfully!\",\n  \"input\": {}\n}"
}
```

### Local development

You can invoke your function locally by using the following command:

```bash
serverless invoke local --function hello
```
