import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../ddb-doc-client";
import { TableName } from "../../../table-name";
import { EQueueStatus } from "../../queues/enums/queue-status.enum";
import { QueueItem } from "../../queues/model/queue-item";

export async function putItemBackToQueue(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    return;
  }
  const res = await ddbDocClient.send(
    new GetCommand({
      TableName,
      Key: QueueItem.buildKey(servicePoint.currentQueueItem),
    })
  );

  if (!res.Item) {
    throw new Error("Queue item not found");
  }
  const queueItem = QueueItem.fromItem(res.Item);

  queueItem.queueStatus = EQueueStatus.QUEUED;

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression:
              "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
            ExpressionAttributeNames: {
              "#queueStatus": "queueStatus",
              "#date": "date",
              "#GSI1SK": "GSI1SK",
            },
            ExpressionAttributeValues: {
              ":queueStatus": queueItem.queueStatus,
              ":date": queueItem.date,
              ":GSI1SK": queueItem.GSI1SK,
            },
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression: "SET currentQueueItem = :currentQueueItem",
            ExpressionAttributeValues: {
              ":currentQueueItem": "",
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
      ],
    })
  );
}
