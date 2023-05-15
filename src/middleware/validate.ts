import middy from "@middy/core";
import Ajv from "ajv";
import { ValidateFunction, JTDDataType } from "ajv/dist/core";
import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import createError from "http-errors";
interface Options<TEvent = any, TContext = any, TResponse = any> {
  validateEventSchema?: ValidateFunction<JTDDataType<TEvent>>;
  validateContextSchema?: ValidateFunction<JTDDataType<TContext>>;
  validateResponseSchema?: ValidateFunction<JTDDataType<TResponse>>;
}

const ajv = new Ajv();
export const validate = (
  options: Options
): middy.MiddlewareObj<APIGatewayProxyEventV2, APIGatewayProxyResultV2> => {
  const { validateEventSchema, validateContextSchema, validateResponseSchema } =
    options;
  return {
    before: async (request) => {
      const { event, context } = request;

      if (validateEventSchema && !validateEventSchema(event)) {
        throw createError(400, {
          message: "Bad Request",
          detail: ajv.errorsText(validateEventSchema.errors),
        });
      }
      if (validateContextSchema && !validateContextSchema(context)) {
        throw createError(500, {
          message: "Internal Server Error",
        });
      }
    },
    after: async (request) => {
      const { response } = request;
      if (validateResponseSchema && !validateResponseSchema(response)) {
        throw createError(500, {
          message: "Internal Server Error",
        });
      }
    },
  };
};
