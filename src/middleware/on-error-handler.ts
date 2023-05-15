import middy from "@middy/core";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";

export const onErrorHandler: middy.MiddlewareFn<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> = (request) => {
  const error = request.error as {
    statusCode?: number;
    message?: string;
    detail?: string;
  };

  if (!error.statusCode) {
    request.response = {
      statusCode: 500,
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
      headers: {
        "content-type": "application/json",
      },
    };
  } else {
    request.response = {
      statusCode: error.statusCode,
      body: JSON.stringify({
        message: error?.message || "Internal Server Error",
        detail: error?.detail,
      }),
      headers: {
        "content-type": "application/json",
      },
    };
  }
};
