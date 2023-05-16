
import { DynamoDBStreamHandler } from "aws-lambda";
import middy from "@middy/core";
import errorLogger from "@middy/error-logger";
import { onErrorHandler } from "../../../middleware/on-error-handler";
import { sendUpdatesToBoard } from "./send-updates-to-board";

export const lambdaHandler: DynamoDBStreamHandler = async (event) => {
  await sendUpdatesToBoard(event);
};

export const handler = middy(lambdaHandler)
  .use(errorLogger())
  .onError(onErrorHandler);
