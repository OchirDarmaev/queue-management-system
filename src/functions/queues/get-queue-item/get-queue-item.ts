import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../ddb-doc-client";
import { QueueItem } from "../model/QueueItem";
import { IGetQueueItem } from "./get-queue-item.interface";
import { getQueuePosition } from "../queue";
import { TableName } from "../../../table-name";

export async function getQueueItem({
  pathParameters: { queueId },
}: IGetQueueItem): Promise<{
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
