import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane";
import { getQueuedInfo } from "./queue";
import { QueueItem } from "./model/QueueItem";

// stream handler dynamodb
// dynamodb stream handler

export async function updateBoardHandler(event, context) {
  console.log("event", event);
  const records = event.Records;
  if (!records) {
    return;
  }
  console.log("records", JSON.stringify(records, null, 2));

  const serviceIds = new Set<string>();
  for (const record of records) {
    if (record.eventName === "INSERT" || record.eventName === "MODIFY") {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        continue;
      }
      const prefix = newImage.PK?.S;
      if (prefix !== QueueItem.prefix) {
        console.log("prefix is not queue" + prefix);

        continue;
      }
      const serviceId = newImage.serviceId?.S;
      if (!serviceId) {
        throw new Error("serviceId is not defined");
      }
      serviceIds.add(serviceId);
    }
  }
  const messageToSend = await getQueuedInfo();

  const topicPrefix = process.env.TOPIC_PREFIX;
  if (!topicPrefix) {
    throw new Error("TOPIC_PREFIX is not defined");
  }

  const topicName = `${topicPrefix}/board`;
  console.log(`Publishing to topic: ${topicName}`);

  const iotPublishCommand = new PublishCommand({
    topic: topicName,
    payload: Buffer.from(JSON.stringify(messageToSend)),
  });
  const client = new IoTDataPlaneClient({});
  const response = await client.send(iotPublishCommand);
  console.log("response", response);
}
