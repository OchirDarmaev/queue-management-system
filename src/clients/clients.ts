import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { prefixClient, prefixQueue, TableName } from "../db";
import { ulid } from "ulid";
import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

export enum ClientStatus {
  QUEUED = "queued",
  SERVED = "served",
  CANCELLED = "cancelled",
}

export const getQueueHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const res = await getQueue();
    return {
      statusCode: 200,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const addNewClientToQueueHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const serviceId = event.pathParameters.serviceId;
    const res = await addNewClientToQueue({ serviceId });
    return {
      statusCode: 201,
      body: JSON.stringify(res),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: "Internal Server Error",
    };
  }
};

export const getQueuePositionByClientIdHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { serviceId, clientId } = event.pathParameters;
    const queuePositionResponse = await getQueuePositionById({
      serviceId,
      clientId,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(queuePositionResponse),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
    };
  }
};

async function getQueue() {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": {
          S: "QUEUE",
        },
      },
    })
  );
  return result.Items;
}

async function addNewClientToQueue({
  serviceId,
  clientId,
}: {
  serviceId: string;
  clientId?: string;
}): Promise<{
  serviceId: string;
  clientId: string;
  numberInQueue: number;
}> {
  const id = clientId ?? ulid();
  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: {
              PK: prefixQueue + serviceId,
              SK: prefixClient + id,
              client_status: ClientStatus.QUEUED,
              GSI1PK: "QUEUE",
            },
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
      ],
    })
  );

  const numberInQueue = await getQueuePositionById({ serviceId, clientId: id });
  return {
    serviceId,
    clientId: id,
    numberInQueue: numberInQueue.numberInQueue,
  };
}

async function getQueuePositionById({
  serviceId,
  clientId,
}: {
  serviceId: string;
  clientId: string;
}): Promise<{
  clientId: string;
  numberInQueue: number;
}> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk AND SK <= :sk",
      FilterExpression: "client_status = :client_status",
      ExpressionAttributeValues: {
        ":pk": {
          S: prefixQueue + serviceId,
        },
        ":sk": {
          S: prefixClient + clientId,
        },
        ":client_status": {
          S: ClientStatus.QUEUED,
        },
      },
      Select: "COUNT",
    })
  );

  return {
    clientId,
    numberInQueue: result.Count,
  };
}
