//test handler

import { APIGatewayProxyEvent } from "aws-lambda";

export const handlerProtected = async (
  event: APIGatewayProxyEvent,
  _context
) => {
  // log event to dynamodb table
  console.log(JSON.stringify(event, null, 2));

  const { sub, email } = event.requestContext?.authorizer?.jwt?.claims || {};

  console.log("Hello World");
  return {
    statusCode: 200,
    body: `Hello World ${sub} ${email}`,
  };
};

export const handlerPublic = async (event: APIGatewayProxyEvent, _context) => {
  // log event to dynamodb table
  console.log(JSON.stringify(event, null, 2));
  console.log("Hello World");
  return {
    statusCode: 200,
    body: "Hello World Public",
  };
};
