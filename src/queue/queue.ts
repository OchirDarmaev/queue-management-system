import {
  GetCommand,
  TransactWriteCommand,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyHandler } from "aws-lambda";
import { ddbDocClient } from "../dynamoDB";
import { TableName } from "../db";
import { ulid } from "ulid";
import { getServiceFromServicePointsIds } from "../servicePoints/servicePoints";
import { Item } from "../baseItem";
import { ServiceItem } from "../services/services";

const prefixServiceQueue = "SQ#";
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
    this.id = queueItem.id;
    this.serviceId = queueItem.serviceId;
    this.queueStatus = queueItem.queueStatus;
    this.priority = queueItem.priority;
    this.date = queueItem.date;
  }
  get PK(): string {
    return QueueItem.prefix;
  }
  get SK(): string {
    return QueueItem.buildKey(this.id).SK;
  }

  get GSI1PK(): string {
    return prefixServiceQueue + this.serviceId;
  }

  get GSI1SK(): string {
    return `${prefixQueueStatus}${this.queueStatus}Q_PRIORITY#${this.priority}#Q_DATE${this.date}`;
  }

  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceId: this.serviceId,
      queueStatus: this.queueStatus,
      priority: this.priority,
      date: this.date,
      GSI1PK: this.GSI1PK,
      GSI1SK: this.GSI1SK,
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
        ":gsi1pk": `${prefixServiceQueue}${serviceId}`,
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

async function getQueuePosition({
  GSI1PK,
  GSI1SK,
}: QueueItem): Promise<number> {
  if (!GSI1SK.startsWith(prefixQueueStatus + QueueStatus.QUEUED)) {
    throw new Error("Queue item is not queued");
  }

  const queuePositionResult = await ddbDocClient.send(
    new QueryCommand({
      TableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :gsi1pk and GSI1SK < :gsi1sk",
      ExpressionAttributeValues: {
        ":gsi1pk": GSI1PK,
        ":gsi1sk": GSI1SK,
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
}): Promise<Partial<Record<QueueStatus, QueueItem[]>>> {
  const itemsByStatus = await Promise.all(
    queueStatuses.map(async (queueStatus) => ({
      queueStatus: queueStatus,
      // to do take a look order issue
      items: (
        await Promise.all(
          serviceIds.map((serviceId) =>
            getQueuedItems({ serviceId, limit, queueStatus })
          )
        )
      ).flat(),
    }))
  );

  return Object.fromEntries(
    itemsByStatus.map((item) => [item.queueStatus, item.items])
  );
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
      IndexName: "GSI1",
      KeyConditionExpression:
        "GSI1PK = :gsi1pk and begins_with(GSI1SK, :gsi1sk)",
      ExpressionAttributeValues: {
        ":gsi1pk": `${prefixServiceQueue}${serviceId}`,
        ":gsi1sk": prefixQueueStatus + queueStatus,
      },
      Limit: limit,
      ScanIndexForward: true,
    })
  );

  return result.Items?.map((item) => QueueItem.fromItem(item)) ?? [];
}
