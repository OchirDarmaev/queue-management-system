import {
  BatchGetCommand,
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import {
  buildQueueKey,
  buildQueueSK,
  prefixQueue,
  prefixQueueStatus,
  TableName,
} from "../db";
import { ulid } from "ulid";
import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb";

export enum QueueStatus {
  QUEUED = "0-queued",
  SERVED = "1-served",
  CANCELLED = "2-cancelled",
}

export enum QueuePriority {
  high = "0-high",
  medium = "1-medium",
}

export const createQueueItemHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { serviceId } = event.pathParameters;
    const res = await createQueueItem({ serviceId });
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

export const getQueueItemHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { queueId } = event.pathParameters;
    const item = await getQueueItem({
      queueId,
    });
    return {
      statusCode: 200,
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
    };
  }
};

export const getQueueItemsHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const serviceId = event.pathParameters.serviceId;
    const res = await getQueueItems({ serviceId });
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

export const updateQueueItemHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const { queueId } = event.pathParameters;
    const { status, priority } = JSON.parse(event.body);
    const res = await updateQueueItem({
      queueId,
      status,
      priority,
    });
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

async function getQueueItem({ queueId }: { queueId: string }) {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: {
        PK: prefixQueue + queueId,
        SK: prefixQueue + queueId,
      },
    })
  );

  const item = result.Item;

  if (!item) {
    throw new Error("Queue item not found");
  }

  const queuePosition = await getQueuePosition({
    gsi1pk: item.GSI1PK,
    gsi1sk: item.GSI1SK,
  });

  return {
    ...item,
    queuePosition,
  };
}

async function getQueueItems({ serviceId }: { serviceId: string }) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": {
          S: buildQueueKey(serviceId),
        },
      },
      ScanIndexForward: true,
    })
  );

  return result.Items;
}

async function createQueueItem({ serviceId }: { serviceId: string }): Promise<{
  serviceId: string;
  id: string;
  queuePosition: number;
}> {
  const id = ulid();
  const pk = buildQueueKey(serviceId);
  const item = {
    status: QueueStatus.QUEUED,
    priority: QueuePriority.medium,
    dateISOString: new Date().toISOString(),
  };
  const sk = buildQueueSK(item);
  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName,
            Item: {
              PK: prefixQueue + id,
              SK: prefixQueue + id,
              GSI1PK: pk,
              GSI1SK: sk,
              ...item,
            },
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
      ],
    })
  );

  const queuePosition = await getQueuePosition({ gsi1pk: pk, gsi1sk: sk });
  return {
    id,
    serviceId,
    queuePosition,
  };
}

async function getQueuePosition({
  gsi1pk,
  gsi1sk,
}: {
  gsi1pk: string;
  gsi1sk: string;
}): Promise<number> {
  if (!gsi1sk.startsWith(prefixQueueStatus + QueueStatus.QUEUED)) {
    return 0;
  }

  const queuePositionResult = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk and GSI1SK < :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": {
          S: gsi1pk,
        },
        ":gsi1sk": {
          S: gsi1sk,
        },
      },
      Select: "COUNT",
      ScanIndexForward: true,
    })
  );
  return queuePositionResult.Count;
}

async function updateQueueItem({
  queueId,
  status,
  priority,
}: {
  queueId: string;
  status?: QueueStatus;
  priority?: QueuePriority;
}) {
  const item = await getQueueItem({ queueId });

  const gsi1sk = buildQueueSK({
    status: status ?? item.status,
    priority: priority ?? item.priority,
    dateISOString: item.dateISOString,
  });

  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: {
        PK: prefixQueue + queueId,
        SK: prefixQueue + queueId,
      },
      UpdateExpression: "SET GSI1SK = :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1sk": gsi1sk,
      },
    })
  );
}
