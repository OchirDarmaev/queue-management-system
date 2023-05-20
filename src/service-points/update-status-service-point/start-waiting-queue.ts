import { ddbDocClient } from "../../ddb-doc-client";
import {
  TransactWriteCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";
import { TableName } from "../../table-name";
import { getItemsBy } from "../../functions/boards/get-items-by";
import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { EQueueStatus } from "../../functions/queues/enums/queue-status.enum";


export async function startWaitingQueue(servicePoint: ServicePointItem) {
  if (servicePoint.currentQueueItem) {
    return;
  }
  const items = await getItemsBy({
    servicePoints: [servicePoint],
    limit: 1,
    queueStatus: EQueueStatus.QUEUED,
  });
  const queueItem = items[0];
  if (!queueItem) {
    // waiting queue is empty
    // set service point status to waiting
    await ddbDocClient.send(
      new UpdateCommand({
        TableName,
        Key: servicePoint.keys(),
        UpdateExpression: "SET #servicePointStatus = :servicePointStatus",
        ExpressionAttributeNames: {
          "#servicePointStatus": "servicePointStatus",
        },
        ExpressionAttributeValues: {
          ":servicePointStatus": EServicePointStatus.WAITING,
        },
      })
    );
    return;
  }
  queueItem.queueStatus = EQueueStatus.PENDING;

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
          },
        },
        {
          Update: {
            TableName: TableName,
            Key: servicePoint.keys(),
            UpdateExpression: "SET currentQueueItem = :currentQueueItem, servicePointStatus = :servicePointStatus",
            ExpressionAttributeValues: {
              ":currentQueueItem": queueItem.id,
              ":servicePointStatus": EServicePointStatus.WAITING,
            },
            ConditionExpression: "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
      ],
    })
  );
}
