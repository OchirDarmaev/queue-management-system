import {
  QueryCommand,
  BatchGetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../ddb-doc-client";
import { TableName } from "../../table-name";
import { ServiceItem } from "../../services/ServiceItem";
import { getServicePoints } from "../../servicePoints/servicePoints";
import { ServicePointItem } from "../../servicePoints/ServicePointItem";
import { ServicePointStatus } from "../../servicePoints/ServicePointStatus";
import { EQueuePriority } from "./enums/queue-priority.enum";
import { EQueueStatus } from "./enums/queue-status.enum";
import { IQueueItem } from "./queue-item.interface";
import { QueueItem } from "./model/QueueItem";
import { getQueueItem } from "./get-queue-item/get-queue-item";

export async function getQueueItems({
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

export async function getQueuePosition(queueItem: QueueItem): Promise<number> {
  if (queueItem.queueStatus !== EQueueStatus.QUEUED) {
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

export async function updateQueueItem({
  queueId,
  priority,
}: {
  queueId: string;
  priority: EQueuePriority;
}) {
  const queueItem = await getQueueItem({ pathParameters: { queueId } });

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

export async function getQueuedInfo() {
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
  queueStatus: EQueueStatus;
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
    queueStatus: EQueueStatus.QUEUED,
  });

  const servicePointIsInProgress = servicePoints.filter(
    (x) =>
      x.servicePointStatus === ServicePointStatus.IN_SERVICE ||
      (x.servicePointStatus === ServicePointStatus.WAITING &&
        x.currentQueueItem)
  );

  const keys = servicePointIsInProgress.map((servicePoint) =>
    QueueItem.buildKey(servicePoint.currentQueueItem)
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
  queueStatus: EQueueStatus;
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
