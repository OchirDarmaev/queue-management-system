import {
  TransactWriteCommand,
  QueryCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { TableName } from "../db";
import { ulid } from "ulid";
import { Item } from "../baseItem";
import { ServiceItem } from "../services/services";
import {
  ServicePointItem,
  getServicePointHandler,
  getServicePoints,
  getServicePointsHandler,
} from "../servicePoints/servicePoints";
import { BatchGetItemCommand } from "@aws-sdk/client-dynamodb";

const prefixQueue = "Q#";
const prefixQueueStatus = "Q_STATUS#";

export enum QueueStatus {
  QUEUED = "queued",
  PENDING = "pending",
  IN_SERVICE = "in-service",
  SERVED = "served",
  SKIPPED = "skipped",
}

export enum QueuePriority {
  high = "1",
  medium = "5",
}

export interface IQueueItem {
  id: string;
  serviceId: string;
  queueStatus: QueueStatus;
  priority: QueuePriority;
  date: string;
}

export class QueueItem extends Item {
  static prefix = prefixQueue;

  public id: string;
  public serviceId: string;
  public queueStatus: QueueStatus;
  public priority: QueuePriority;
  public date: string;
  constructor(queueItem: IQueueItem) {
    super();
    this.serviceId = queueItem.serviceId;
    this.queueStatus = queueItem.queueStatus;
    this.priority = queueItem.priority;
    this.date = queueItem.date;
  }
  get PK(): string {
    return QueueItem.prefix + ServiceItem.prefixService + this.serviceId;
  }
  get SK(): string {
    return `${prefixQueueStatus}${this.queueStatus}Q_PRIORITY#${this.priority}#Q_DATE${this.date}`;
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceId: this.serviceId,
      queueStatus: this.queueStatus,
      priority: this.priority,
      date: this.date,
    };
  }

  static fromItem(item: Record<string, unknown>): QueueItem {
    return new QueueItem({
      id: (item.SK as string).replace(QueueItem.prefix, ""),
      serviceId: item.serviceId as string,
      queueStatus: item.queueStatus as QueueStatus,
      priority: item.priority as QueuePriority,
      date: item.date as string,
    });
  }

  static buildKey(queueId: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: QueueItem.prefix,
      SK: QueueItem.prefix + queueId,
    };
  }
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
  throw new Error("Not implemented");
  // try {
  //   const queueId = event.pathParameters?.queueId;
  //   if (!queueId) {
  //     return {
  //       statusCode: 400,
  //       body: "Bad Request",
  //     };
  //   }
  //   const item = await getQueueItem({
  //     queueId,
  //   });
  //   return {
  //     statusCode: 200,
  //     body: JSON.stringify(item),
  //   };
  // } catch (error) {
  //   console.error(error);
  //   return {
  //     statusCode: 500,
  //     body: "Internal Server Error",
  //   };
  // }
};

export const getQueueItemsHandler: APIGatewayProxyHandler = async (
  event,
  context
) => {
  throw new Error("Not implemented");
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
  throw new Error("Not implemented");
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
    const { queueStatus, priority } = JSON.parse(event.body);
    const res = await updateQueueItem({
      queueId,
      queueStatus,
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

export async function getQueueItem({ queueId }: { queueId: string }): Promise<{
  item: QueueItem;
  queuePosition: number;
}> {
  // const result = await ddbDocClient.send(
  //   new GetCommand({
  //     TableName,
  //     Key: QueueItem.buildKey(queueId),
  //   })
  // );
  // if (!result.Item) {
  //   throw new Error("Queue item not found");
  // }
  // const item = QueueItem.fromItem(result.Item);
  // const queuePosition = await getQueuePosition(item);
  // return {
  //   item,
  //   queuePosition,
  // };
}

async function getQueueItems({
  serviceId,
}: {
  serviceId: string;
}): Promise<IQueueItem[]> {
  const result = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `${QueueItem.prefix}${ServiceItem.prefix}${serviceId}`,
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
      };
    }) || []
  );
}

async function createQueueItem({ serviceId }: { serviceId: string }): Promise<{
  item: QueueItem;
  queuePosition: number;
}> {
  const queueItem = new QueueItem({
    id: ulid(),
    serviceId,
    queueStatus: QueueStatus.QUEUED,
    priority: QueuePriority.medium,
    date: new Date().toISOString(),
  });

  const serviceKey = ServiceItem.buildKey(serviceId);

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
  if (!queueItem.SK.startsWith(prefixQueueStatus + QueueStatus.QUEUED)) {
    return -1;
  }

  const queuePositionResult = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      KeyConditionExpression: "PK = :pk AND SK < :sk",
      ExpressionAttributeValues: {
        ":pk": queueItem.PK,
        ":sk": queueItem.SK,
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
  date,
}: {
  queueId: string;
  queueStatus?: QueueStatus;
  priority?: QueuePriority;
  date?: string;
}) {
  throw new Error("Not implemented");
}

async function getQueuedInfo() {
  const servicePoints = await getServicePoints();
  return await getItemsByStatus({
    servicePoints,

    limit: 10,
  });
}

export async function getItemsByStatus({
  servicePoints,
  limit,
}: {
  servicePoints: ServicePointItem[];
  limit: number;
}): Promise<{
  items: QueueItem[];
  items2: QueueItem[];
}> {
  const serviceIds = [
    ...new Set(
      servicePoints.flatMap((servicePoint) => servicePoint.serviceIds)
    ),
  ];

  const items = (
    await Promise.all(
      serviceIds.map((serviceId) =>
        getQueuedItems({ serviceId, limit, queueStatus: QueueStatus.QUEUED })
      )
    )
  ).flat();

  const keys = servicePoints
    .filter((x) => x.currentQueueItem)
    .map((x) => x.currentQueueItem);
  if (keys.length === 0) {
    return {
      items,
      items2: [],
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

  return {
    items,
    items2: Responses?.[TableName]?.map((x) => QueueItem.fromItem(x)) ?? [],
  };
}

export async function getQueuedItems({
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

      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: {
        ":pk": `${QueueItem.prefix}${ServiceItem.prefixService}${serviceId}`,
        ":sk": prefixQueueStatus + queueStatus,
      },
      Limit: limit,
      ScanIndexForward: true,
    })
  );

  return result.Items?.map((item) => QueueItem.fromItem(item)) ?? [];
}
