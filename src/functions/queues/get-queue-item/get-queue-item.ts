import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../ddb-doc-client";
import { QueueItem } from "../model/queue-item";
import { getQueuePosition } from "./get-queue-position";
import { TableName } from "../../../table-name";

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
