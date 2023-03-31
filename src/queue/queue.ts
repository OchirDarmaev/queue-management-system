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

const prefixServiceQueue = "SQ#";
export const prefixQueue = "Q#";
export const prefixQueueStatus = "Q_STATUS#";
export const buildQueueKey = (serviceId: string) =>
  `${prefixServiceQueue}${serviceId}`;

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

export interface IQueueItem {
  id: string;
  serviceId: string;
  status: QueueStatus;
  priority: QueuePriority;
  dateISOString: string;
}

export class QueueItem extends Item {
  static prefix = prefixQueue;

  public id: string;
  public serviceId: string;
  public status: QueueStatus;
  public priority: QueuePriority;
  public dateISOString: string;
  constructor(queueItem: IQueueItem) {
    super();
    this.id = queueItem.id;
    this.serviceId = queueItem.serviceId;
    this.status = queueItem.status;
    this.priority = queueItem.priority;
    this.dateISOString = queueItem.dateISOString;
  }
  get PK(): string {
    return QueueItem.prefix + this.id;
  }
  get SK(): string {
    return QueueItem.prefix + this.id;
  }

  get GSI1PK(): string {
    return buildQueueKey(this.serviceId);
  }

  // sort order in queue
  get GSI1SK(): string {
    return this.buildQueueSK({
      status: this.status,
      priority: this.priority,
      dateISOString: this.dateISOString,
    });
  }
  toItem(): Record<string, unknown> {
    return {
      ...this.keys(),
      serviceId: this.serviceId,
      status: this.status,
      priority: this.priority,
      dateISOString: this.dateISOString,
      GSI1PK: this.GSI1PK,
      GSI1SK: this.GSI1SK,
    };
  }

  private buildQueueSK({
    status,
    priority,
    dateISOString,
  }: {
    status: QueueStatus;
    priority: QueuePriority;
    dateISOString: string;
  }) {
    return `${prefixQueueStatus}${status}Q_PRIORITY#${priority}#Q_DATE${dateISOString}`;
  }

  static fromItem(item: Record<string, unknown>): QueueItem {
    return new QueueItem({
      id: (item.PK as string).replace(QueueItem.prefix, ""),
      serviceId: item.serviceId as string,
      status: item.status as QueueStatus,
      priority: item.priority as QueuePriority,
      dateISOString: item.dateISOString as string,
    });
  }
  static buildKey(queueId: string): {
    PK: string;
    SK: string;
  } {
    return {
      PK: QueueItem.prefix + queueId,
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
        ":gsi1pk": buildQueueKey(serviceId),
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
        status: i.status,
        priority: i.priority,
        dateISOString: i.dateISOString,
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
  dateISOString,
}: {
  queueId: string;
  status?: QueueStatus;
  priority?: QueuePriority;
  dateISOString?: string;
}) {
  throw new Error("Not implemented");

  //need to update GSI1SK when updating priority or date

  //   const item = await getQueueItem({ queueId });
  //   const newPriority = priority ?? item.priority;
  //   const newDate = dateISOString ?? item.dateISOString;
  // const gsi1sk =buildQueueSK({
  //   status: item.status ,
  //   priority: newPriority,
  //   dateISOString: newDate,
  // });
  //   await ddbDocClient.send(
  //     new UpdateCommand({
  //       TableName,
  //       Key: {
  //         PK: prefixQueue + queueId,
  //         SK: prefixQueue + queueId,
  //       },
  //       UpdateExpression:
  //         "SET GSI1SK = :gsi1sk,  #priority = :priority, #dateISOString = :dateISOString",
  //       ExpressionAttributeNames: {
  //         "#queueStatus": "queueStatus",
  //         "#priority": "priority",
  //         "#dateISOString": "dateISOString",
  //       },
  //       ExpressionAttributeValues: {
  //         ":gsi1sk": gsi1sk,
  //         ":priority": newPriority,
  //         ":dateISOString": newDate,
  //       },
  //     })
  //   );
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

  return (
    result.Items?.map((item) => {
      const i = QueueItem.fromItem(item);
      return {
        id: i.id,
        serviceId: i.serviceId,
        status: i.status,
        priority: i.priority,
        dateISOString: i.dateISOString,
      };
    }) ?? []
  );
}
