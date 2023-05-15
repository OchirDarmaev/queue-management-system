import Ajv, { JSONSchemaType } from "ajv";
import { IGetQueueItem } from "./get-queue-item.interface";
const ajv = new Ajv();

const schema: JSONSchemaType<IGetQueueItem> = {
  type: "object",
  required: ["pathParameters"],
  properties: {
    pathParameters: {
      type: "object",
      properties: {
        queueId: {
          type: "string",
          minLength: 26,
          maxLength: 26,
        },
      },
      required: ["queueId"],
    },
  },
};

export const validateEventSchema = ajv.compile(schema);
