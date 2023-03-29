import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { ulid } from "ulid";

import {
  BatchGetCommand,
  DeleteCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { prefixService, TableName } from "../db";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  BatchGetItemCommand,
  TransactWriteItemsCommand,
} from "@aws-sdk/client-dynamodb";

export const handler: APIGatewayProxyHandler = async (event, context) => {
  try {
    switch (event.httpMethod) {
      case "GET": {
        const result = await getServices();
        return {
          statusCode: 200,
          body: JSON.stringify(result),
        };
      }
      case "POST": {
        const res = await createService(event);

        return {
          statusCode: 201,
          body: JSON.stringify(res),
        };
      }
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
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": prefixService,
      },
    })
  );
  const keys = result.Items.map((item) => ({
    PK: item.SK,
    SK: item.SK,
  }));
  const services = await ddbDocClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TableName]: {
          Keys: keys,
        },
      },
    })
  );
  return services.Responses[TableName];
}

async function createService(event) {
  const { name, description } = JSON.parse(event.body);
  const id = ulid();
  await ddbDocClient.send(
    new TransactWriteItemsCommand({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: {
              PK: {
                S: prefixService + id,
              },
              SK: {
                S: prefixService + id,
              },
              name: {
                S: name,
              },
              description: {
                S: description,
              },
            },
          },
        },
        {
          Put: {
            TableName,
            Item: {
              PK: {
                S: prefixService,
              },
              SK: {
                S: prefixService + id,
              },
            },
          },
        },
      ],
    })
  );

  return {
    id: id,
    name: name,
    description: description,
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
    ConditionExpression: "attribute_exists(PK)",
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
