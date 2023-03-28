import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { ulid } from "ulid";

import {
  DeleteCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { prefixService, TableName } from "../db";
import { QueryCommand } from "@aws-sdk/client-dynamodb";

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
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": {
          S: "SERVICE",
        },
      },
    })
  );
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
}

async function createService(event) {
  const { name, description } = JSON.parse(event.body);
  const id = ulid();
  const params = {
    TableName,
    Item: {
      PK: prefixService + id,
      SK: prefixService + id,
      name,
      description,
      GSI1PK: "SERVICE",
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
    TableName,
    Key: { PK: prefixService + serviceId, SK: prefixService + serviceId },

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
  const { serviceId: serviceId } = JSON.parse(event.body);
  const params = {
    TableName,
    Key: { PK: prefixService + serviceId, SK: prefixService + serviceId },
    ConditionExpression: "attribute_exists(service_id)",
  };
  await ddbDocClient.send(new DeleteCommand(params));
  return {
    statusCode: 204,
    body: "",
  };
}
