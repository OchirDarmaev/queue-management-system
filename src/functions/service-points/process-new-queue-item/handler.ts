import { DynamoDBStreamHandler } from "aws-lambda";
import { QueueItem } from "../../queues/model/queue-item";
import { notifyNewItem } from "./process-new-queue-item";
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";

const lambdaHandler: DynamoDBStreamHandler = async (event) => {
  const records = event.Records;
  if (!records) {
    return;
  }

  for (const record of records) {
    if (record.eventName === "INSERT") {
      const newImage = record.dynamodb?.NewImage;
      if (!newImage) {
        continue;
      }
      const prefix = newImage.PK?.S;
      if (prefix !== QueueItem.prefix) {
        continue;
      }
      const serviceId = newImage.serviceId?.S;
      if (!serviceId) {
        throw new Error("serviceId is not defined");
      }
      await notifyNewItem(serviceId);
    }
  }
};

export const handler = middy(lambdaHandler)
  .use(errorLogger())
  .onError(onErrorHandler);
