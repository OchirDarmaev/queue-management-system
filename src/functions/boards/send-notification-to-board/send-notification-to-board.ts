import { DynamoDBStreamEvent } from "aws-lambda";
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { getQueuedInfo } from "../get-queue-status/get-queued-info";

export const sendNotificationToBoard = async (event: DynamoDBStreamEvent) => {
  const records = event.Records;
  if (!records?.length) {
    return;
  }

  // that code used to send
  // const serviceIds = new Set<string>();
  // for (const record of records) {
  //   if (record.eventName === "INSERT" || record.eventName === "MODIFY") {
  //     const newImage = record.dynamodb?.NewImage;
  //     if (!newImage) {
  //       continue;
  //     }
  //     const prefix = newImage.PK?.S;
  //     if (prefix !== QueueItem.prefix) {
  //       continue;
  //     }
  //     const serviceId = newImage.serviceId?.S;
  //     if (!serviceId) {
  //       throw new Error("serviceId is not defined");
  //     }
  //     serviceIds.add(serviceId);
  //   }
  // }
  const messageToSend = await getQueuedInfo();

  const topicPrefix = process.env.TOPIC_PREFIX;
  if (!topicPrefix) {
    throw new Error("TOPIC_PREFIX is not defined");
  }

  const topicName = `${topicPrefix}/board`;
  console.debug(`Publishing to topic: ${topicName}`);

  const iotPublishCommand = new PublishCommand({
    topic: topicName,
    payload: Buffer.from(JSON.stringify(messageToSend)),
  });
  const client = new IoTDataPlaneClient({});
  const response = await client.send(iotPublishCommand);
  console.debug("response", response);
};
