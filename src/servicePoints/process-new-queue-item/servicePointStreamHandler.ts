import { QueueItem } from "../../functions/queues/model/queue-item";
import { notifyNewItem } from "./notifyNewItem";

// dynamodb stream handler DynamoDBStreamHandler

export async function servicePointStreamHandler(event,
  context) {
  console.log("event", event);
  const records = event.Records;
  if (!records) {
    return;
  }
  console.log("records", JSON.stringify(records, null, 2));

  for (const record of records) {
    if (record.eventName === "INSERT") {
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
      await notifyNewItem(serviceId);
    }
  }
}
