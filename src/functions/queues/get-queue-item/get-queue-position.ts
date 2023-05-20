import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { EQueueStatus } from "../enums/queue-status.enum";
import { QueueItem } from "../model/queue-item";
import { TableName } from "../../../table-name";

export async function getQueuePosition(queueItem: QueueItem): Promise<number> {
  if (queueItem.queueStatus !== EQueueStatus.QUEUED) {
    return -1;
  }

  const itemsBeforeItemResult = await ddbDocClient.send(
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
  if (!itemsBeforeItemResult || itemsBeforeItemResult.Count === undefined) {
    throw new Error("Queue position not found");
  }

  return itemsBeforeItemResult.Count + 1;
}
