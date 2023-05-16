import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../ddb-doc-client";
import { ulid } from "ulid";
import { ServiceItem } from "../../../services/ServiceItem";
import { EQueuePriority } from "../enums/queue-priority.enum";
import { EQueueStatus } from "../enums/queue-status.enum";
import { QueueItem } from "../model/queue-item";
import { getQueuePosition } from "../get-queue-position";
import { createMemorableId } from "./create-memorable-id";
import { TableName } from "../../../table-name";

export async function createQueueItem({
  serviceId,
}: {
  serviceId: string;
}): Promise<{
  item: QueueItem;
  queuePosition: number;
}> {
  const id = ulid();
  const memorableId = await createMemorableId(serviceId);
  const queueItem = new QueueItem({
    id,
    serviceId,
    queueStatus: EQueueStatus.QUEUED,
    priority: EQueuePriority.medium,
    date: new Date().toISOString(),
    memorableId,
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
