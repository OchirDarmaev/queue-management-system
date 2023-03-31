import {
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
  QueryCommand,
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
import { getServiceFromServicePointsIds } from "../servicePoints/servicePoints";

export enum QueueStatus {
  QUEUED = "00-queued",
  PENDING = "01-pending",
  IN_SERVICE = "02-in-service",
  SERVED = "03-served",
  SKIPPED = "04-skipped",
}

export enum QueuePriority {
  high = "00-high",
  medium = "01-medium",
}

export const createQueueItemHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const serviceId = event.pathParameters?.serviceId;
    if (!serviceId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
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
    const queueId = event.pathParameters?.queueId;
    if (!queueId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
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
      body: "Internal Server Error",
    };
  }
};

export const getQueueItemsHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const serviceId = event.pathParameters?.serviceId;
    if (!serviceId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
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
    const queueId = event.pathParameters?.queueId;
    if (!queueId) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
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

// getQueueStatusHandler
export const getQueueStatusHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  try {
    const res = await getQueuedInfo();
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

export async function getQueueItem({ queueId }: { queueId: string }) {
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
        ":gsi1pk": buildQueueKey(serviceId),
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
  const item = {};
  const sk = buildQueueSK({
    status: QueueStatus.QUEUED,
    priority: QueuePriority.medium,
    dateISOString: new Date().toISOString(),
  });
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
              queueStatus: QueueStatus.QUEUED,
              queuePriority: QueuePriority.medium,
              queueDate: new Date().toISOString(),
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
    throw new Error("Queue item is not queued");
  }

  const queuePositionResult = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk and GSI1SK < :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": gsi1pk,
        ":gsi1sk": gsi1sk,
      },
      Select: "COUNT",
      ScanIndexForward: true,
    })
  );
  if (!queuePositionResult) {
    throw new Error("Queue position not found");
  }
  return (queuePositionResult.Count as number) + 1;
}

async function updateQueueItem({
  queueId,
  status,
  priority,
  dateISOString,
}: {
  queueId: string;
  status?: QueueStatus;
  priority?: QueuePriority;
  dateISOString?: string;
}) {
  const item = await getQueueItem({ queueId });
  const newPriority = priority ?? item.priority;
  const newDate = dateISOString ?? item.dateISOString;
const gsi1sk =buildQueueSK({
  status: item.status ,
  priority: newPriority,
  dateISOString: newDate,
})
  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: {
        PK: prefixQueue + queueId,
        SK: prefixQueue + queueId,
      },
      UpdateExpression:
        "SET GSI1SK = :gsi1sk,  #priority = :priority, #dateISOString = :dateISOString",
      ExpressionAttributeNames: {
        "#queueStatus": "queueStatus",
        "#priority": "priority",
        "#dateISOString": "dateISOString",
      },
      ExpressionAttributeValues: {
        ":gsi1sk": ,
        ":priority": newPriority,
        ":dateISOString": newDate,
      },
    })
  );
}

async function getQueuedInfo() {
  const serviceIds = await getServiceFromServicePointsIds();
  return await getItemsByStatus({
    serviceIds,
    queueStatuses: Object.values(QueueStatus),
    limit: 10,
  });
}

export async function getItemsByStatus({
  serviceIds,
  queueStatuses,
  limit,
}: {
  serviceIds: string[];
  queueStatuses: QueueStatus[];
  limit: number;
}): Promise<Partial<Record<QueueStatus, unknown[]>>> {
  const itemsByStatus = await Promise.all(
    queueStatuses.map(async (status) => ({
      status,
      // to do take a look order issue
      items: (
        await Promise.all(
          serviceIds.map((serviceId) =>
            getQueuedItems({ serviceId, limit, status })
          )
        )
      ).flat(),
    }))
  );

  return Object.fromEntries(
    itemsByStatus.map((item) => [item.status, item.items])
  );
}

export async function getQueuedItems({
  serviceId,
  limit,
  status,
}: {
  serviceId: string;
  limit: number;
  status: QueueStatus;
}) {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression:
        "GSI1PK = :gsi1pk and begins_with(GSI1SK, :gsi1sk)",
      ExpressionAttributeValues: {
        ":gsi1pk": buildQueueKey(serviceId),
        ":gsi1sk": prefixQueueStatus + status,
      },
      Limit: limit,
      ScanIndexForward: true,
    })
  );

  return result.Items;
}
