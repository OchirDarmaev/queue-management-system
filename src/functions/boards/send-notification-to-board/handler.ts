
import { DynamoDBStreamHandler } from "aws-lambda";
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { sendNotificationToBoard } from "./send-notification-to-board";

export const lambdaHandler: DynamoDBStreamHandler = async (event) => {
  await sendNotificationToBoard(event);
};

export const handler = middy(lambdaHandler)
  .use(errorLogger())
  .onError(onErrorHandler);
