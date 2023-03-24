import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let options = {};
// connect to local DB if running offline
if (process.env.IS_OFFLINE) {
  options = {
    region: "localhost",
    endpoint: "http://localhost:8000",
  };
}

const dynamoDB = new DynamoDBClient({ ...options });

export const ddbDocClient = DynamoDBDocumentClient.from(dynamoDB, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
}); // client is DynamoDB client
