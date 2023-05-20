import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import { EQueueStatus } from "../../queues/enums/queue-status.enum";
import { QueueItem } from "../../queues/model/queue-item";

export async function startServicingItemQueue(servicePoint: ServicePointItem) {
  if (!servicePoint.currentQueueItem) {
    throw new Error("Queue item not defined");
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
  queueItem.queueStatus = EQueueStatus.IN_SERVICE;

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
            UpdateExpression:
              "SET servicePointStatus = :servicePointStatus, currentQueueItem = :currentQueueItem",
            ExpressionAttributeValues: {
              ":servicePointStatus": EServicePointStatus.IN_SERVICE,
              ":currentQueueItem": queueItem.id,
            },

            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentQueueItem)",
          },
        },
      ],
    })
  );
}
