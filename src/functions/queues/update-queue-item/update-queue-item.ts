import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../ddb-doc-client";
import { EQueuePriority } from "../enums/queue-priority.enum";
import { QueueItem } from "../model/queue-item";
import { getQueueItem } from "../get-queue-item/get-queue-item";
import { TableName } from "../../../table-name";


export async function updateQueueItem({
  queueId, priority,
}: {
  queueId: string;
  priority: EQueuePriority;
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
