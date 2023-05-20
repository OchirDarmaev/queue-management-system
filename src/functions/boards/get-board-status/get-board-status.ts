import { BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import { EQueueStatus } from "../../queues/enums/queue-status.enum";
import { getItemsBy } from "../get-items-by";
import { QueueItem } from "../../queues/model/queue-item";
import { ServicePointItem } from "../../service-points/model/service-point-item";
import { EServicePointStatus } from "../../service-points/service-point-status.enum";

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
  const itemsInQueue = await getItemsBy({
    servicePoints,
    limit,
    queueStatus: EQueueStatus.QUEUED,
  });

  const servicePointIsInProgress = servicePoints.filter(
    (x) =>
      x.servicePointStatus === EServicePointStatus.IN_SERVICE ||
      (x.servicePointStatus === EServicePointStatus.WAITING &&
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
