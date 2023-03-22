import { APIGatewayProxyHandler } from "aws-lambda";
import { v4 as uuidv4 } from "uuid";
import AWS from "aws-sdk";

let options = {};

// connect to local DB if running offline
if (process.env.IS_OFFLINE) {
  options = {
    region: "localhost",
    endpoint: "http://localhost:8000",
  };
}

const dynamoDB = new AWS.DynamoDB.DocumentClient(options);

export const createQueue: APIGatewayProxyHandler = async (event) => {
  const { servicePointIds, name } = JSON.parse(event.body);

  const queue = {
    id: uuidv4(),
    servicePointIds,
    name,
  };

  const params = {
    TableName: process.env.QUEUES_TABLE,
    Item: queue,
  };

  await dynamoDB.put(params).promise();

  return {
    statusCode: 201,
    body: JSON.stringify(queue),
  };
};

export const deleteQueue: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const params = {
    TableName: process.env.QUEUES_TABLE,
    Key: { id },
  };

  await dynamoDB.delete(params).promise();

  return {
    statusCode: 204,
    body: "",
  };
};

export const getAllQueues: APIGatewayProxyHandler = async (event) => {
  console.log("getAllQueues");
  console.log(process.env.QUEUES_TABLE);
  const params = {
    TableName: process.env.QUEUES_TABLE,
  };

  const result = await dynamoDB.scan(params).promise();

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
};
