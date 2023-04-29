//test handler

import { APIGatewayProxyEvent } from "aws-lambda";
import { EAction } from "../auth/enums/action.enum";
import { ESubject } from "../auth/enums/subject.enum";
import { check } from "../auth/check";

export const handlerProtected = async (
  event: APIGatewayProxyEvent,
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

export const handlerPublic = async (event: APIGatewayProxyEvent, _context) => {
  // log event to dynamodb table
  console.log(JSON.stringify(event, null, 2));
  console.log("Hello World");
  return {
    statusCode: 200,
    body: "Hello World Public",
  };
};
