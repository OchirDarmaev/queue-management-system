import { EQueueStatus } from "../queues/enums/queue-status.enum";
import { QueueItem } from "../queues/model/queue-item";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../ddb-doc-client";
import { TableName } from "../../table-name";
import { ServicePointItem } from "../service-points/model/service-point-item";
import { ServiceItem } from "../services/model/service-item";

export async function getItemsBy({
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
