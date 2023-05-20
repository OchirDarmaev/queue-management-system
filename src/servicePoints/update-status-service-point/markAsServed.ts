import { ddbDocClient } from "../../ddb-doc-client";
import {
  GetCommand,
  TransactWriteCommand
} from "@aws-sdk/lib-dynamodb";
import { TableName } from "../../table-name";
import { QueueItem } from "../../functions/queues/model/queue-item";
import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { EQueueStatus } from "../../functions/queues/enums/queue-status.enum";


export async function markAsServed(servicePoint: ServicePointItem) {
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
  queueItem.queueStatus = EQueueStatus.SERVED;

  await ddbDocClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TableName,
            Key: queueItem.keys(),
            UpdateExpression: "SET #queueStatus = :queueStatus, #date = :date, #GSI1SK = :GSI1SK",
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
            ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression: "SET currentQueueItem = :currentQueueItem, servicePointStatus = :servicePointStatus ",
            ExpressionAttributeValues: {
              ":currentQueueItem": "",
              ":servicePointStatus": EServicePointStatus.SERVED,
            },
            ConditionExpression: "attribute_exists(PK) and attribute_exists(SK) and attribute_exists(currentQueueItem)",
          },
        },
      ],
    })
  );
}
