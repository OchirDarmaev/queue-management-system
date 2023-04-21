import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let options = {};

if (process.env.IS_OFFLINE) {
  options = {
    region: "us-east-1",
    endpoint: "http://localhost:8000",
  };
}

const dynamoDB = new DynamoDBClient({ ...options });

export const ddbDocClient = DynamoDBDocumentClient.from(dynamoDB, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
