import { TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { EServicePointStatus } from "../service-point-status.enum";
import { ServicePointItem } from "../model/service-point-item";
import { ddbDocClient } from "../../../dynamo-DB-client";
import { TableName } from "../../../table-name";
import { getItemsBy } from "../../boards/get-items-by";
import { EQueueStatus } from "../../queues/enums/queue-status.enum";
import { getServicePoint } from "../get-service-point/get-service-point";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";

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
              "SET currentQueueItem = :currentQueueItem, servicePointStatus = :servicePointStatus",
            ExpressionAttributeValues: {
              ":currentQueueItem": queueItem.id,
              ":servicePointStatus": EServicePointStatus.WAITING,
            },
            ConditionExpression:
              "attribute_exists(PK) and attribute_exists(SK)",
          },
        },
      ],
    })
  );

  const updatedServicePoint = await getServicePoint({ id: servicePoint.id });

  const topicPrefix = process.env.TOPIC_PREFIX;
  if (!topicPrefix) {
    throw new Error("TOPIC_PREFIX is not defined");
  }

  const topicName = `${topicPrefix}/service-points/${servicePoint.id}`;
  console.debug(`Publishing to topic: ${topicName}`);

  const iotPublishCommand = new PublishCommand({
    topic: topicName,
    payload: Buffer.from(JSON.stringify(updatedServicePoint)),
  });
  const client = new IoTDataPlaneClient({});
  const res = await client.send(iotPublishCommand);

  console.debug(`Published to topic: ${topicName}`);
}
