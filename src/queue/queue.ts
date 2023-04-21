import {
  TransactWriteCommand,
  QueryCommand,
  BatchGetCommand,
  UpdateCommand,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../ddb-doc-client";
import { TableName } from "../table-name";
import { ulid } from "ulid";
import { ServiceItem } from "../services/ServiceItem";
import { getServicePoints } from "../servicePoints/servicePoints";
import { ServicePointItem } from "../servicePoints/ServicePointItem";
import { ServicePointStatus } from "../servicePoints/ServicePointStatus";
import { QueuePriority } from "./QueuePriority";
import { QueueStatus } from "./QueueStatus";
import { IQueueItem } from "./IQueueItem";
import { QueueItem } from "./QueueItem";

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
    const { priority } = JSON.parse(event.body);
    if (!priority) {
      return {
        statusCode: 400,
        body: "Bad Request",
      };
    }
    const res = await updateQueueItem({
      queueId,
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

async function getQueueItem({ queueId }: { queueId: string }): Promise<{
  item: QueueItem;
  queuePosition: number;
}> {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: QueueItem.buildKey(queueId),
    })
  );
  if (!result.Item) {
    throw new Error("Queue item not found");
  }
  const item = QueueItem.fromItem(result.Item);
  const queuePosition = await getQueuePosition(item);

  return {
    item,
    queuePosition,
  };
}

async function getQueueItems({
  serviceId,
}: {
  serviceId: string;
}): Promise<IQueueItem[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk",
      ExpressionAttributeValues: {
        ":gsi1pk": `${QueueItem.prefix}${ServiceItem.prefixService}${serviceId}`,
      },
      ScanIndexForward: true,
    })
  );

  return (
    result.Items?.map((item) => {
      const i = QueueItem.fromItem(item);
      return {
        id: i.id,
        serviceId: i.serviceId,
        queueStatus: i.queueStatus,
        priority: i.priority,
        date: i.date,
        memorableId: i.memorableId,
      };
    }) || []
  );
}

async function createQueueItem({ serviceId }: { serviceId: string }): Promise<{
  item: QueueItem;
  queuePosition: number;
}> {
  const id = ulid();
  const memorableId = await createMemorableId(serviceId);
  const queueItem = new QueueItem({
    id,
    serviceId,
    queueStatus: QueueStatus.QUEUED,
    priority: QueuePriority.medium,
    date: new Date().toISOString(),
    memorableId,
  });

  const serviceKey = ServiceItem.buildKey(serviceId);
  const i = queueItem.toItem();
  console.log(JSON.stringify(i));

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          ConditionCheck: {
            TableName,
            Key: serviceKey,
            ConditionExpression:
              "attribute_exists(PK) AND attribute_exists(SK)",
          },
        },
        {
          Put: {
            TableName,
            Item: queueItem.toItem(),
            ConditionExpression:
              "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
      ],
    })
  );

  const queuePosition = await getQueuePosition(queueItem);

  return {
    item: queueItem,
    queuePosition,
  };
}

async function getQueuePosition(queueItem: QueueItem): Promise<number> {
  if (!queueItem.GSI1SK.startsWith(QueueItem.prefix + QueueStatus.QUEUED)) {
    return -1;
  }

  const queuePositionResult = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk AND GSI1SK < :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": queueItem.GSI1PK,
        ":gsi1sk": queueItem.GSI1SK,
      },
      Select: "COUNT",
      ScanIndexForward: true,
    })
  );
  if (!queuePositionResult || queuePositionResult.Count === undefined) {
    throw new Error("Queue position not found");
  }

  return queuePositionResult.Count + 1;
}

async function updateQueueItem({
  queueId,
  priority,
}: {
  queueId: string;
  priority: QueuePriority;
}) {
  const queueItem = await getQueueItem({ queueId });

  queueItem.item.priority = priority;

  await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: QueueItem.buildKey(queueId),
      UpdateExpression: "SET priority = :priority, GSI1SK = :gsi1sk",
      ExpressionAttributeValues: {
        ":priority": priority,
        ":gsi1sk": queueItem.item.GSI1SK,
      },
    })
  );
}

async function getQueuedInfo() {
  const servicePoints = await getServicePoints();
  return await getBoardStatus({
    servicePoints,

    limit: 10,
  });
}

export async function getItemsByStatus1({
  servicePoints,
  queueStatus,
  limit,
}: {
  servicePoints: ServicePointItem[];
  queueStatus: QueueStatus;
  limit: number;
}): Promise<QueueItem[]> {
  const serviceIds = [
    ...new Set(
      servicePoints.flatMap((servicePoint) => servicePoint.serviceIds)
    ),
  ];

  return (
    await Promise.all(
      serviceIds.map((serviceId) =>
        getQueuedItems({ serviceId, limit, queueStatus })
      )
    )
  ).flat();
}

export async function getBoardStatus({
  servicePoints,
  limit,
}: {
  servicePoints: ServicePointItem[];
  limit: number;
}): Promise<{
  items: {
    servicePointNumber: string;
    item: QueueItem;
  }[];
}> {
  const itemsInQueue = await getItemsByStatus1({
    servicePoints,
    limit,
    queueStatus: QueueStatus.QUEUED,
  });

  const servicePointIsInProgress = servicePoints.filter(
    (x) =>
      x.servicePointStatus === ServicePointStatus.IN_SERVICE ||
      x.servicePointStatus === ServicePointStatus.WAITING
  );

  const keys = servicePointIsInProgress.map((servicePoint) =>
    QueueItem.buildKey(servicePoint.currentQueueItem!)
  );

  if (keys.length === 0) {
    return {
      items: itemsInQueue.map((item) => ({
        servicePointNumber: "",
        item,
      })),
    };
  }
  const { Responses } = await ddbDocClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TableName]: {
          Keys: keys,
        },
      },
    })
  );

  const itemsInProgress =
    Responses?.[TableName]?.map((x) => QueueItem.fromItem(x)) ?? [];
  const itemById = Object.fromEntries(itemsInProgress.map((x) => [x.id, x]));

  return {
    items: [
      ...servicePointIsInProgress
        .map((servicePoint) => ({
          servicePointNumber: servicePoint.servicePointNumber,
          item: itemById[servicePoint.currentQueueItem!],
        }))
        .sort((a, b) => a.item.GSI1SK.localeCompare(b.item.GSI1SK) * -1),
      ...itemsInQueue.map((item) => ({
        servicePointNumber: "",
        item,
      })),
    ],
  };
}

async function getQueuedItems({
  serviceId,
  limit,
  queueStatus,
}: {
  serviceId: string;
  limit: number;
  queueStatus: QueueStatus;
}): Promise<QueueItem[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression:
        "GSI1PK = :gsi1pk AND begins_with(GSI1SK, :gsi1sk)",
      ExpressionAttributeValues: {
        ":gsi1pk": `${QueueItem.prefix}${ServiceItem.prefixService}${serviceId}`,
        ":gsi1sk": QueueItem.prefixQueueStatus + queueStatus,
      },
      Limit: limit,
      ScanIndexForward: true,
    })
  );

  return result.Items?.map((item) => QueueItem.fromItem(item)) ?? [];
}

/**
 * Pool ids '[A-z]-[0-9]{3}' (e.g. A-001...Z-999)
 * */
// todo Rotate pool ids every 1000 ids
async function createMemorableId(serviceId: string): Promise<string> {
  const prefixPoolIds = "PI#";
  const serviceItem = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: {
        PK: ServiceItem.prefixService,
        SK: ServiceItem.prefixService + serviceId,
      },
    })
  );
  const serviceName = serviceItem.Item?.name;
  const firstLetterServiceName = serviceName[0];
  const poolName = "FirstPool";
  const res = await ddbDocClient.send(
    new UpdateCommand({
      TableName,
      Key: {
        PK: prefixPoolIds + poolName,
        SK: firstLetterServiceName,
      },
      UpdateExpression: "ADD #counter :increment",
      ExpressionAttributeNames: {
        "#counter": "counter",
      },
      ExpressionAttributeValues: {
        ":increment": 1,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  const counter = res.Attributes?.counter;

  return firstLetterServiceName + "-" + counter.toString().padStart(3, "0");
}
