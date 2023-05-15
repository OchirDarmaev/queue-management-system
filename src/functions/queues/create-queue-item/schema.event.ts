import Ajv, { JSONSchemaType } from "ajv";
import { ICreateQueueItem } from "./create-queue-item.interface";

const ajv = new Ajv();

const schema: JSONSchemaType<ICreateQueueItem> = {
  type: "object",
  required: ["body"],
  properties: {
    body: {
      type: "object",
      properties: {
        serviceId: {
          type: "string",
          minLength: 26,
          maxLength: 26,
        },
      },
      required: ["serviceId"],
    },
  },
};

const validateEventSchema = ajv.compile(schema);

export { validateEventSchema };
