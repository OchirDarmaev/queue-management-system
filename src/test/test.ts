//test handler

import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2WithJWTAuthorizer,
} from "aws-lambda";
import { EAction } from "../auth/enums/action.enum";
import { ESubject } from "../auth/enums/subject.enum";
import { check } from "../auth/check";

export const handlerProtected = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  _context
) => {
  // log event to dynamodb table
  console.log(JSON.stringify(event, null, 2));

  const { sub, email } = event.requestContext?.authorizer?.jwt?.claims || {};

  if (!check(event, EAction.Create, ESubject.ServicePoint)) {
    return {
      statusCode: 403,
      body: `Forbidden`,
    };
  }

  console.log("Hello World");
  return {
    statusCode: 200,
    body: `Hello World ${sub} ${email}`,
  };
};
import {
  IoTDataPlaneClient,
  PublishCommand,
} from "@aws-sdk/client-iot-data-plane"; // ES Modules import

export const handlerPublic = async (event: APIGatewayProxyEvent, _context) => {
  try {
    const client = new IoTDataPlaneClient({});
    const messageToSend = {
      message: "Hello from Lambda",
      timestamp: new Date().toISOString(),
    };

    const topicPrefix = process.env.TOPIC_PREFIX;
    if (!topicPrefix) {
      throw new Error("TOPIC_PREFIX is not defined");
    }

    const topicName = `${topicPrefix}/test-topic`;
    console.log(`Publishing to topic: ${topicName}`);

    const iotPublishCommand = new PublishCommand({
      topic: topicName,
      payload: Buffer.from(JSON.stringify(messageToSend)),
    });

    const response = await client.send(iotPublishCommand);

    console.log(JSON.stringify(event, null, 2));
    console.log("Hello World");
    return {
      statusCode: 200,
      body: JSON.stringify({
        response,
      }),
      headers: {
        "content-type": "application/json",
      },
    };
  } catch (err) {
    console.log(err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        err,
      }),
    };
  }
};
