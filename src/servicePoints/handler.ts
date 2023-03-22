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

export const createServicePoint: APIGatewayProxyHandler = async (event) => {
  const { name } = JSON.parse(event.body);

  const servicePoint = {
    id: uuidv4(),
    name,
  };

  const params = {
    TableName: process.env.SERVICE_POINTS_TABLE,
    Item: servicePoint,
  };

  await dynamoDB.put(params).promise();

  return {
    statusCode: 201,
    body: JSON.stringify(servicePoint),
  };
};

export const deleteServicePoint: APIGatewayProxyHandler = async (event) => {
  const { id } = event.pathParameters;

  const params = {
    TableName: process.env.SERVICE_POINTS_TABLE,
    Key: { id },
  };

  await dynamoDB.delete(params).promise();

  return {
    statusCode: 204,
    body: "",
  };
};

export const getAllServicePoints: APIGatewayProxyHandler = async (event) => {
  const params = {
    TableName: process.env.SERVICE_POINTS_TABLE,
  };

  const result = await dynamoDB.scan(params).promise();

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
};
