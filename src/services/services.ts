import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { v4 as uuidv4 } from "uuid";
import {
  DeleteCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  try {
    switch (event.httpMethod) {
      case "GET":
        return await getServices();
      case "POST":
        return await createService(event);
      case "PUT":
        return await updateService(event);
      case "DELETE":
        return await deleteService(event);
      default:
        return {
          statusCode: 405,
          body: "Method Not Allowed",
        };
    }
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

async function getServices() {
  const result = await ddbDocClient.send(
    new ScanCommand({
      TableName: process.env.SERVICES_TABLE,
    })
  );
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function createService(event) {
  const { name, description } = JSON.parse(event.body);
  const id = uuidv4();
  const params = {
    TableName: process.env.SERVICES_TABLE,
    Item: {
      id,
      name,
      description,
    },
    ReturnValues: "ALL_OLD",
  };
  const result = await ddbDocClient.send(new PutCommand(params));
  return {
    statusCode: 201,
    body: JSON.stringify(result.Attributes),
  };
}

async function updateService(event) {
  const serviceId = event.pathParameters.serviceId;
  const { name, description } = JSON.parse(event.body);
  const params = {
    TableName: process.env.SERVICES_TABLE,
    Key: { id: serviceId },
    UpdateExpression: "set #n = :n, #d = :d",
    ExpressionAttributeNames: { "#n": "name", "#d": "description" },
    ExpressionAttributeValues: { ":n": name, ":d": description },
    ReturnValues: "ALL_NEW",
  };
  const result = await ddbDocClient.send(new UpdateCommand(params));
  return {
    statusCode: 200,
    body: JSON.stringify(result.Attributes),
  };
}

async function deleteService(event) {
  const { service_id } = JSON.parse(event.body);
  const params = {
    TableName: process.env.SERVICES_TABLE,
    Key: { service_id },
    ConditionExpression: "attribute_exists(service_id)",
  };
  await ddbDocClient.send(new DeleteCommand(params));
  return {
    statusCode: 204,
    body: "",
  };
}
